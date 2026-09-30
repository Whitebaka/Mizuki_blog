#!/usr/bin/env python3
"""Build deterministic web derivatives from an explicitly selected Photo_View folder.
Requires Pillow; never falls back to Master. Run with --help for the private output contract.
"""
import argparse, hashlib, io, json, struct
from pathlib import Path
from PIL import Image, ImageCms, ImageOps

def build(source, selection, output, url_prefix):
    source = source.resolve(strict=True)
    if source.name != 'Photo_View':
        raise ValueError('Source must be the Photo_View directory; Master is never accepted')
    rows = json.loads(selection.read_text())
    if not rows or len({r['id'] for r in rows}) != len(rows):
        raise ValueError('Selection must be nonempty with unique IDs')
    output.mkdir(parents=True, exist_ok=True)
    assets, audit = {}, []
    profile = ImageCms.createProfile('sRGB')
    icc_bytes = bytearray(ImageCms.ImageCmsProfile(profile).tobytes())
    icc_bytes[24:36] = struct.pack('>6H', 2000, 1, 1, 0, 0, 0)
    icc = bytes(icc_bytes)
    for row in rows:
        name = row['filename']
        if Path(name).name != name:
            raise ValueError('Only direct filenames are accepted')
        path = (source / name).resolve(strict=True)
        if path.parent != source:
            raise ValueError('Symlink escapes Photo_View')
        raw = path.read_bytes()
        source_sha = hashlib.sha256(raw).hexdigest()
        with Image.open(io.BytesIO(raw)) as original:
            color = original.info.get('icc_profile')
            im = ImageOps.exif_transpose(original)
            if color:
                im = ImageCms.profileToProfile(im, ImageCms.ImageCmsProfile(io.BytesIO(color)), profile, outputMode='RGB')
            else:
                raise ValueError(f'Missing ICC profile: {name}; explicitly establish source color space first')
            variants = []
            for edge in (640, 1600, 2400):
                resized = im.copy()
                resized.thumbnail((edge, edge), Image.Resampling.LANCZOS)
                for fmt, ext, quality in [('WEBP','webp',84),('JPEG','jpg',88)]:
                    encoded=io.BytesIO()
                    resized.save(encoded,fmt,quality=quality,icc_profile=icc,**({'method':6} if fmt=='WEBP' else {'optimize':True,'progressive':True}))
                    blob=encoded.getvalue()
                    digest=hashlib.sha256(blob).hexdigest()
                    filename=f"{row['id']}-{edge}-{digest[:12]}.{ext}"
                    (output/filename).write_bytes(blob)
                    variants.append({'url':url_prefix.rstrip('/')+'/'+filename,'width':resized.width,'height':resized.height,'bytes':len(blob),'format':'webp' if ext=='webp' else 'jpeg'})
            assets[row['id']]={'id':row['id'],'alt':'','width':im.width,'height':im.height,'variants':variants,'publicationApproved':False}
        audit.append({'id':row['id'],'sourceKind':'Photo_View','filename':name,'sourceSha256':source_sha,'sourceBytes':len(raw)})
    (output/'assets.json').write_text(json.dumps(assets,ensure_ascii=False,indent=2)+'\n')
    (output/'source-audit.private.json').write_text(json.dumps({'sourceDirectory':str(source),'assets':audit},ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'images':len(assets),'derivatives':len(assets)*6,'bytes':sum(v['bytes'] for a in assets.values() for v in a['variants'])}))

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source',type=Path,required=True)
    parser.add_argument('--selection',type=Path,required=True)
    parser.add_argument('--output',type=Path,required=True,help='Private build directory, not public/. Copy only image files to public.')
    parser.add_argument('--url-prefix',default='/photobooks/botan')
    a=parser.parse_args()
    build(a.source,a.selection,a.output,a.url_prefix)
