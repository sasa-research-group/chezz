# Sourced by the run*.sh bakes before they cd into the stage folder. A GUARD, PROP or CHAR_GLB given relative to the
# caller's folder was read from the stage folder instead and not found (11/21 on the PC), so make them absolute here.
# abspath PATH: PATH as it is when absolute (/..., ~..., C:/...), else under the current folder.
abspath() {
  case "$1" in
    "" | /* | "~"* | [A-Za-z]:[/\\]*) printf '%s' "$1" ;;
    *) printf '%s/%s' "$PWD" "${1#./}" ;;
  esac
}
for _v in GUARD PROP CHAR_GLB; do
  [ -n "${!_v}" ] && export "$_v=$(abspath "${!_v}")"
done
unset _v
