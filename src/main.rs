use rquickjs::{Context, Function, Promise, Runtime};
use std::fs;
use std::path::PathBuf;
use tailwindcss_oxide::{PublicSourceEntry, Scanner};

/// Minimal oxide-backed scan: one glob, base=dir, pattern `**/*`.
fn scan(dir: String) -> Vec<String> {
    let mut scanner = Scanner::new(vec![PublicSourceEntry {
        base: dir,
        pattern: "**/*".to_string(),
        negated: false,
    }]);
    scanner.scan()
}

/// Host file-read bridge for the driver's loadStylesheet (relative CSS imports).
/// Returns io::Error directly: rquickjs converts it into a JS exception
/// (`IntoJs for Result<T, E> where Error: From<E>`).
fn tw_read(path: String) -> std::result::Result<String, std::io::Error> {
    fs::read_to_string(&path)
}

const USAGE: &str = "\
tailwindcss-qjs-poc: compile Tailwind v4 + daisyUI inside QuickJS (POC)

Usage:
  tailwindcss-qjs-poc -i <input.css> -o <output.css> [--content <dir> ...] [--watch [--poll <ms>]]
  tailwindcss-qjs-poc --self-test
  tailwindcss-qjs-poc --help

Options:
  -i, --input <file>     Input CSS (`@import \"tailwindcss\"; @plugin \"daisyui\";`). Required.
  -o, --output <file>    Where to write compiled CSS. Required.
  --content <dir>        Oxide scan base dir (repeatable). Default: the input
                         file's own parent dir. Each dir is scanned with a single
                         glob (base=dir, pattern `**/*`); candidates are unioned.
  --watch                Rebuild on change (polling, see below). Single-threaded;
                         Ctrl-C just kills the process (no handler).
  --poll <ms>            Poll interval for --watch (default 250, matching
                         upstream). Rejected without --watch.
  --self-test            Run the step 1 + 2 diagnostics (hello eval, scan binding,
                         bytecode roundtrip, fixture build with asserts).
  -h, --help             Print this usage.

Watch semantics: after the initial build, the watched file set is the oxide
Scanner's own scanned files plus the input CSS. Every <poll> ms their mtimes
(+ file size as tiebreak) are compared; on change the scan + QuickJS build
re-run in the same persistent context and the output is rewritten only if
bytes differ. Polling, not fs-events — no extra deps.

Exit codes: 0 ok, 1 build failure, 2 usage/CLI error.
POC limits: tailwindcss checkout expected at ../tailwindcss relative to cwd;
no minify, no sourcemaps.\
";

struct Cli {
    input: PathBuf,
    output: PathBuf,
    contents: Vec<String>,
    watch: bool,
    poll_ms: u64,
    theme: String,
}

fn parse_cli(argv: &[String]) -> Result<Cli, String> {
    let mut input: Option<PathBuf> = None;
    let mut output: Option<PathBuf> = None;
    let mut contents: Vec<String> = vec![];
    let mut watch = false;
    let mut poll_ms: u64 = 250;
    let mut poll_given = false;
    let mut theme = String::new();
    let mut i = 0;
    while i < argv.len() {
        match argv[i].as_str() {
            "-i" | "--input" => {
                i += 1;
                let v = argv.get(i).ok_or("missing value for --input")?;
                input = Some(PathBuf::from(v));
            }
            "-o" | "--output" => {
                i += 1;
                let v = argv.get(i).ok_or("missing value for --output")?;
                output = Some(PathBuf::from(v));
            }
            "--content" => {
                i += 1;
                let v = argv.get(i).ok_or("missing value for --content")?;
                contents.push(v.clone());
            }
            "--watch" => watch = true,
            "--poll" => {
                i += 1;
                let v = argv.get(i).ok_or("missing value for --poll")?;
                poll_ms = v
                    .parse::<u64>()
                    .map_err(|_| format!("invalid --poll value: {v}"))?;
                poll_given = true;
            }
            "--theme" => {
                if i + 1 < argv.len() {
                    theme = argv.get(i + 1).cloned().unwrap_or_default();
                    i += 1; // skip the value so the outer i += 1 doesn't double-consume
                } else {
                    return Err("missing value for --theme".to_string());
                }
            }
            other => return Err(format!("unknown flag: {other}")),
        }
        i += 1;
    }
    let input = input.ok_or("missing required -i/--input")?;
    let output = output.ok_or("missing required -o/--output")?;
    if poll_given && !watch {
        return Err("--poll requires --watch".to_string());
    }
    if !input.is_file() {
        return Err(format!(
            "input file not found: {}",
            input.to_string_lossy()
        ));
    }
    // Default scan base: the input file's own parent dir (documented choice:
    // keeps fixture runs hermetic without forcing --content every time).
    if contents.is_empty() {
        let parent = input
            .parent()
            .filter(|p| !p.as_os_str().is_empty())
            .map(|p| p.to_path_buf())
            .unwrap_or_else(|| PathBuf::from("."));
        contents.push(parent.to_string_lossy().to_string());
    }
    for dir in &contents {
        if !PathBuf::from(dir).is_dir() {
            return Err(format!("content dir not found: {dir}"));
        }
    }
    Ok(Cli {
        input,
        output,
        contents,
        watch,
        poll_ms,
        theme,
    })
}

fn candidates_to_json(candidates: &[String]) -> String {
    format!(
        "[{}]",
        candidates
            .iter()
            .map(|s| format!("{s:?}"))
            .collect::<Vec<_>>()
            .join(",")
    )
}

/// Persistent QuickJS host: one Runtime + Context, bundle source-evaled once
/// (system qjsc bytecode is version-incompatible), reused for every rebuild.
struct Engine {
    _rt: Runtime,
    ctx: Context,
}

impl Engine {
    fn new() -> Result<Self, String> {
        let rt = Runtime::new().map_err(|e| format!("runtime init failed: {e}"))?;
        let ctx = Context::full(&rt).map_err(|e| format!("context init failed: {e}"))?;
        ctx.with(|ctx| -> Result<(), String> {
            ctx.globals()
                .set("scan", Function::new(ctx.clone(), scan).map_err(|e| e.to_string())?)
                .map_err(|e| e.to_string())?;
            ctx.globals()
                .set(
                    "__tw_read",
                    Function::new(ctx.clone(), tw_read).map_err(|e| e.to_string())?,
                )
                .map_err(|e| e.to_string())?;
            ctx.eval::<(), _>(include_str!("../dist/bundle.js"))
                .map_err(|e| format!("bundle eval failed: {e}"))?;
            Ok(())
        })?;
        Ok(Engine { _rt: rt, ctx })
    }

    /// Compile CSS inside QuickJS. Returns (css, buffered console lines).
    fn compile_css(
        &self,
        input_css: &str,
        candidates_json: &str,
        tailwind_css_text: &str,
        tw_dir: &str,
    ) -> Result<(String, Vec<String>), String> {
        self.ctx.with(|ctx| -> Result<(String, Vec<String>), String> {
            ctx.globals()
                .set("__tw_input", input_css.to_string())
                .map_err(|e| e.to_string())?;
            ctx.globals()
                .set("__tw_candidates", candidates_json.to_string())
                .map_err(|e| e.to_string())?;
            ctx.globals()
                .set("__tw_css", tailwind_css_text.to_string())
                .map_err(|e| e.to_string())?;
            ctx.globals()
                .set("__tw_dir", tw_dir.to_string())
                .map_err(|e| e.to_string())?;
            let promise: Promise = ctx
                .eval("TwDriver.build(__tw_input, __tw_candidates, __tw_css, __tw_dir)")
                .map_err(|e| format!("TwDriver.build eval failed: {e}"))?;
            let css: String = promise.finish().map_err(|e| {
                let caught: rquickjs::Value = ctx.catch();
                let detail = caught
                    .into_object()
                    .and_then(rquickjs::Exception::from_object)
                    .map(|ex| format!("message={:?} stack={:?}", ex.message(), ex.stack()))
                    .unwrap_or_else(|| "non-Error thrown".to_string());
                format!("TwDriver.build failed: {e} | {detail}")
            })?;
            // Flush buffered console lines (daisyUI warnings) for the caller.
            let logs: Vec<String> = ctx
                .globals()
                .get("__tw_log")
                .unwrap_or_default();
            Ok((css, logs))
        })
    }
}

/// One oxide Scanner per content dir, kept alive across watch rebuilds so the
/// watched file set can come from the Scanner itself (`get_scanned_files`).
fn scanner_for(dir: &str) -> Scanner {
    Scanner::new(vec![PublicSourceEntry {
        base: dir.to_string(),
        pattern: "**/*".to_string(),
        negated: false,
    }])
}

fn scan_all_scanners(scanners: &mut [Scanner]) -> Vec<String> {
    let mut all: Vec<String> = vec![];
    for s in scanners.iter_mut() {
        all.extend(s.scan());
    }
    all.sort();
    all.dedup();
    all
}

/// Watched files straight from the oxide Scanner (`get_scanned_files` returns
/// what the last `scan()` actually read), plus the input CSS. Missing files
/// are skipped gracefully here; mtime comparison treats disappearance as change.
fn watched_files(scanners: &[Scanner], input: &PathBuf) -> Vec<PathBuf> {
    let mut files: Vec<PathBuf> = scanners
        .iter()
        .flat_map(|s| s.get_scanned_files())
        .map(PathBuf::from)
        .collect();
    files.push(input.clone());
    files.sort();
    files.dedup();
    files
        .into_iter()
        .filter(|p| p.is_file())
        .collect()
}

fn tailwind_dir() -> Result<String, String> {
    let dir = std::env::current_dir()
        .map_err(|e| format!("cannot get cwd: {e}"))?
        .join("../tailwindcss/packages/tailwindcss");
    dir.canonicalize()
        .map(|p| p.to_string_lossy().to_string())
        .map_err(|e| format!("tailwindcss checkout not found at ../tailwindcss: {e}"))
}

struct TwEnv {
    tw_dir: String,
    tailwind_css_text: String,
}

fn load_tw_env() -> Result<TwEnv, String> {
    let tw_dir = tailwind_dir()?;
    let tailwind_css_text = fs::read_to_string(PathBuf::from(&tw_dir).join("index.css"))
        .map_err(|e| format!("cannot read tailwindcss/index.css: {e}"))?;
    Ok(TwEnv {
        tw_dir,
        tailwind_css_text,
    })
}

/// One scan + QuickJS build; shared by one-shot and watch paths.
fn build_once(
    engine: &Engine,
    scanners: &mut [Scanner],
    env: &TwEnv,
    input_css: &str,
) -> Result<(Vec<String>, String, Vec<String>), String> {
    let candidates = scan_all_scanners(scanners);
    let (css, logs) = engine.compile_css(
        input_css,
        &candidates_to_json(&candidates),
        &env.tailwind_css_text,
        &env.tw_dir,
    )?;
    Ok((candidates, css, logs))
}

fn run_build(cli: &Cli) -> i32 {
    let input_css = match fs::read_to_string(&cli.input) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("error: cannot read input {}: {e}", cli.input.to_string_lossy());
            return 2;
        }
    };
    let env = match load_tw_env() {
        Ok(e) => e,
        Err(e) => {
            eprintln!("error: {e}");
            return 1;
        }
    };
    let engine = match Engine::new() {
        Ok(e) => e,
        Err(e) => {
            eprintln!("error: {e}");
            return 1;
        }
    };
    let mut scanners: Vec<Scanner> =
        cli.contents.iter().map(|d| scanner_for(d)).collect();
    match build_once(&engine, &mut scanners, &env, &input_css) {
        Ok((candidates, css, logs)) => {
            println!("[tw] candidates {} {candidates:?}", candidates.len());
            for line in &logs {
                eprintln!("[tw-log] {line}");
            }
            if let Err(e) = fs::write(&cli.output, &css) {
                eprintln!("error: cannot write {}: {e}", cli.output.to_string_lossy());
                return 1;
            }
            println!("[tw] wrote {} ({} bytes)", cli.output.to_string_lossy(), css.len());
            println!("[tw] has `.btn` = {}", css.contains(".btn"));
            println!(
                "[tw] has `--color-primary` = {}",
                css.contains("--color-primary")
            );
            0
        }
        Err(e) => {
            eprintln!("error: build failed: {e}");
            1
        }
    }
}

use std::collections::HashMap;
use std::time::{Duration, Instant, SystemTime};

/// mtime (+size tiebreak) snapshot of the watched set. Unreadable files are
/// simply absent; disappearance therefore shows up as a change.
fn snapshot(files: &[PathBuf]) -> HashMap<PathBuf, (SystemTime, u64)> {
    files
        .iter()
        .filter_map(|p| {
            fs::metadata(p).ok().and_then(|m| {
                m.modified()
                    .ok()
                    .map(|t| (p.clone(), (t, m.len())))
            })
        })
        .collect()
}

fn run_watch(cli: &Cli) -> i32 {
    let env = match load_tw_env() {
        Ok(e) => e,
        Err(e) => {
            eprintln!("error: {e}");
            return 1;
        }
    };
    let engine = match Engine::new() {
        Ok(e) => e,
        Err(e) => {
            eprintln!("error: {e}");
            return 1;
        }
    };
    let mut scanners: Vec<Scanner> =
        cli.contents.iter().map(|d| scanner_for(d)).collect();

    // Initial build, exactly like the one-shot path.
    let input_css = match fs::read_to_string(&cli.input) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("error: cannot read input {}: {e}", cli.input.to_string_lossy());
            return 2;
        }
    };
    let mut last_css = match build_once(&engine, &mut scanners, &env, &input_css) {
        Ok((candidates, css, logs)) => {
            println!("[tw] candidates {} {candidates:?}", candidates.len());
            for line in &logs {
                eprintln!("[tw-log] {line}");
            }
            if let Err(e) = fs::write(&cli.output, &css) {
                eprintln!("error: cannot write {}: {e}", cli.output.to_string_lossy());
                return 1;
            }
            println!("[tw] wrote {} ({} bytes)", cli.output.to_string_lossy(), css.len());
            css
        }
        Err(e) => {
            eprintln!("error: initial build failed: {e}");
            return 1;
        }
    };

    let mut files = watched_files(&scanners, &cli.input);
    let mut snap = snapshot(&files);
    eprintln!(
        "[watch] watching {} files (poll {}ms); Ctrl-C to stop",
        files.len(),
        cli.poll_ms
    );
    loop {
        std::thread::sleep(Duration::from_millis(cli.poll_ms));
        if snapshot(&files) == snap {
            continue;
        }
        let started = Instant::now();
        // Input may have been deleted mid-watch: warn and keep watching.
        let input_css = match fs::read_to_string(&cli.input) {
            Ok(s) => s,
            Err(e) => {
                eprintln!(
                    "[watch] cannot read input {}: {e} (keeping watch)",
                    cli.input.to_string_lossy()
                );
                snap = snapshot(&files);
                continue;
            }
        };
        match build_once(&engine, &mut scanners, &env, &input_css) {
            Ok((candidates, css, logs)) => {
                for line in &logs {
                    eprintln!("[tw-log] {line}");
                }
                if css != last_css {
                    if let Err(e) = fs::write(&cli.output, &css) {
                        eprintln!(
                            "[watch] cannot write {}: {e} (keeping watch)",
                            cli.output.to_string_lossy()
                        );
                    } else {
                        println!(
                            "[tw] rewrote {} ({} bytes, {} candidates)",
                            cli.output.to_string_lossy(),
                            css.len(),
                            candidates.len()
                        );
                        last_css = css;
                    }
                }
            }
            Err(e) => eprintln!("[watch] build failed (keeping watch): {e}"),
        }
        // Refresh the watched set (scans can discover new files) and re-baseline.
        files = watched_files(&scanners, &cli.input);
        snap = snapshot(&files);
        eprintln!("[watch] Done in {}ms", started.elapsed().as_millis());
    }
}

/// Legacy step 1 + 2 diagnostics (hello eval, scan binding, bytecode
/// roundtrip, fixture build with asserts). Preserved for evidence.
fn run_self_test() -> i32 {
    let root = match std::env::current_dir() {
        Ok(p) => p,
        Err(e) => {
            eprintln!("error: {e}");
            return 1;
        }
    };
    let fixture = root.join("fixture");
    if let Err(e) = fs::create_dir_all(&fixture)
        .and_then(|_| fs::write(fixture.join("index.html"), "<div class=\"btn btn-primary card\">hello</div>\n"))
        .and_then(|_| fs::write(root.join("hello.js"), "export const answer = 1 + 2;\n"))
    {
        eprintln!("error: fixture setup failed: {e}");
        return 1;
    }
    let fixture_str = fixture.to_string_lossy().to_string();

    let rt = Runtime::new().expect("runtime");
    let ctx = Context::full(&rt).expect("context");
    ctx.with(|ctx| {
        let answer: i32 = ctx.eval("1 + 2").expect("hello eval");
        println!("[hello] 1 + 2 = {answer}");
        ctx.globals()
            .set("scan", Function::new(ctx.clone(), scan).expect("bind scan"))
            .expect("set scan");
        let found_json: String = ctx
            .eval(format!("JSON.stringify(scan({fixture_str:?}))"))
            .expect("scan eval");
        println!("[scan] candidates JSON = {found_json}");
        let declared =
            rquickjs::Module::declare(ctx.clone(), "hello", "export const answer = 1 + 2;")
                .expect("declare");
        let bytecode: Vec<u8> = declared.write(Default::default()).expect("write");
        println!("[bytecode] wrote {} bytes", bytecode.len());
        let reloaded =
            unsafe { rquickjs::Module::load(ctx.clone(), &bytecode).expect("load") };
        let (evaluated, _) = reloaded.eval().expect("eval");
        while ctx.execute_pending_job() {}
        let a: i32 = evaluated.namespace().expect("ns").get("answer").expect("get");
        assert_eq!(a, 3);
        println!("[bytecode] roundtrip ok: answer = {a}");
    });

    let mut direct = scan(fixture_str);
    direct.sort();
    for want in ["btn", "btn-primary", "card"] {
        assert!(direct.contains(&want.to_string()), "missing {want}");
    }
    println!("[direct] candidates = {direct:?}");

    let tw_dir = match tailwind_dir() {
        Ok(d) => d,
        Err(e) => {
            eprintln!("error: {e}");
            return 1;
        }
    };
    let input_css = fs::read_to_string(fixture.join("input.css")).expect("input.css");
    let tailwind_css_text =
        fs::read_to_string(PathBuf::from(&tw_dir).join("index.css")).expect("index.css");
    let engine = Engine::new().expect("engine");
    match engine.compile_css(
        &input_css,
        &candidates_to_json(&direct),
        &tailwind_css_text,
        &tw_dir,
    ) {
        Ok((css, logs)) => {
            for line in &logs {
                eprintln!("[tw-log] {line}");
            }
            assert!(css.contains(".btn") && css.contains("--color-primary"));
            println!("[tw] fixture build ok ({} bytes)", css.len());
            println!("OK: self-test passed");
            0
        }
        Err(e) => {
            eprintln!("error: self-test build failed: {e}");
            1
        }
    }
}

fn main() {
    let argv: Vec<String> = std::env::args().skip(1).collect();
    if argv.iter().any(|a| a == "-h" || a == "--help") {
        print!("{USAGE}");
        std::process::exit(0);
    }
    if argv.iter().any(|a| a == "--self-test") {
        std::process::exit(run_self_test());
    }
    match parse_cli(&argv) {
        Ok(cli) => {
            if cli.watch {
                std::process::exit(run_watch(&cli))
            } else {
                std::process::exit(run_build(&cli))
            }
        }
        Err(e) => {
            eprintln!("error: {e}\n\n{USAGE}");
            std::process::exit(2);
        }
    }
}
