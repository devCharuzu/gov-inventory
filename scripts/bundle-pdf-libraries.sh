#!/usr/bin/env bash
# Runs only in Vercel's Amazon Linux 2023 build container.
set -euo pipefail
dnf install -y pango fontconfig dejavu-sans-fonts dejavu-serif-fonts patchelf
mkdir -p backend/native/lib backend/native/fonts
for library in /usr/lib64/libpango-1.0.so.0 /usr/lib64/libpangoft2-1.0.so.0 /usr/lib64/libgobject-2.0.so.0 /usr/lib64/libharfbuzz-subset.so.0; do
  test -f "$library"
  cp -L "$library" backend/native/lib/
  while IFS= read -r dependency; do
    case "$(basename "$dependency")" in
      libc.so.*|libm.so.*|libdl.so.*|libpthread.so.*|librt.so.*|libresolv.so.*|libutil.so.*|ld-linux*) continue ;;
    esac
    cp -L "$dependency" backend/native/lib/
  done < <(ldd "$library" | awk '/=> \// {print $3}')
done
# Resolve transitive and cyclic dependencies next to each bundled library.
# Setting LD_LIBRARY_PATH inside a running Python process is too late.
for library in backend/native/lib/*.so*; do
  patchelf --set-rpath '$ORIGIN' "$library"
done
find /usr/share/fonts -type f \( -name '*.ttf' -o -name '*.otf' \) -exec cp '{}' backend/native/fonts/ \;
test -n "$(find backend/native/fonts -type f -print -quit)"
du -sh backend/native
