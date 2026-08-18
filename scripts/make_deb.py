import sys
import os
import time

def make_ar_header(name, size, mtime=None, mode=0o100644):
    if mtime is None:
        mtime = int(time.time())
    name_field = (name.ljust(16))[:16].encode('ascii')
    mtime_field = str(mtime).ljust(12)[:12].encode('ascii')
    uid_field = b"0".ljust(6)
    gid_field = b"0".ljust(6)
    mode_field = oct(mode)[2:].ljust(8)[:8].encode('ascii')
    size_field = str(size).ljust(10)[:10].encode('ascii')
    fmag = b"`\n"
    return name_field + mtime_field + uid_field + gid_field + mode_field + size_field + fmag

def create_deb(out_deb_path, debian_binary_path, control_tar_path, data_tar_path):
    with open(out_deb_path, 'wb') as out_f:
        out_f.write(b"!<arch>\n")
        
        for file_path, ar_name in [
            (debian_binary_path, "debian-binary"),
            (control_tar_path, "control.tar.gz"),
            (data_tar_path, "data.tar.gz")
        ]:
            with open(file_path, 'rb') as in_f:
                data = in_f.read()
            header = make_ar_header(ar_name, len(data))
            out_f.write(header)
            out_f.write(data)
            if len(data) % 2 != 0:
                out_f.write(b"\n")
    print(f"✅ Generated authentic Debian package: {out_deb_path}")

if __name__ == "__main__":
    if len(sys.argv) < 5:
        print("Usage: python3 make_deb.py <out.deb> <debian-binary> <control.tar.gz> <data.tar.gz>")
        sys.exit(1)
    create_deb(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4])
