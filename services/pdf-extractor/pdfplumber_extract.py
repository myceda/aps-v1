import json
import sys

import pdfplumber


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"text": "", "error": "missing file path"}))
        return

    with pdfplumber.open(sys.argv[1]) as pdf:
        text = "\n".join((page.extract_text() or "") for page in pdf.pages)

    print(json.dumps({"text": text}, ensure_ascii=False))


if __name__ == "__main__":
    main()
