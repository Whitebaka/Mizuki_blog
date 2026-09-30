#!/usr/bin/env python3
"""Validate every generated image against assets.json. Requires Pillow."""
import argparse, hashlib, json
from pathlib import Path
from PIL import Image

def verify(directory):
    assets=json.loads((directory/'assets.json').read_text())
    audit=json.loads((directory/'source-audit.private.json').read_text())
    assert len(assets)==len(audit['assets'])
    assert all(a['sourceKind']=='Photo_View' for a in audit['assets'])
    total=0
    for asset in assets.values():
        assert len(asset['variants'])==6
        for variant in asset['variants']:
            file=directory/Path(variant['url']).name
            raw=file.read_bytes()
            assert len(raw)==variant['bytes'], file
            assert hashlib.sha256(raw).hexdigest()[:12] in file.name, file
            with Image.open(file) as im:
                im.load()
                assert im.size==(variant['width'],variant['height']),file
                assert not im.getexif(),file
                assert im.info.get('icc_profile'),file
                assert im.format=={'webp':'WEBP','jpeg':'JPEG'}[variant['format']],file
            total+=len(raw)
    return {'images':len(assets),'derivatives':len(assets)*6,'bytes':total,'sourceKind':'Photo_View','dimensionsAndHashes':'pass','metadata':'ICC retained; EXIF absent'}

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory',type=Path)
    args=parser.parse_args()
    print(json.dumps(verify(args.directory),ensure_ascii=False,indent=2))
