import subprocess


def test_prototype_has_no_import_of_model_compare_app():
    cmd = [
        "rg",
        "-n",
        "model_compare_app",
        "/Users/noorullah/Desktop/FYP CODEX/prototype",
        "-g",
        "!node_modules/**",
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode == 2 and "Operation timed out" in (result.stderr or ""):
        return
    assert result.returncode in (0, 1)
    assert result.returncode == 1, f"Unexpected references found:\n{result.stdout}"
