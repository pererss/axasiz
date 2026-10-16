import urllib.request, re, sys
html = urllib.request.urlopen('https://axasiz.vercel.app/', timeout=25).read().decode('utf-8', 'ignore')
m = re.findall(r'/_next/static/css/[^"]+\.css', html)
print('css files:', m)
css = urllib.request.urlopen('https://axasiz.vercel.app' + m[0], timeout=25).read().decode('utf-8', 'ignore')
print('has reduced-motion (new):', 'prefers-reduced-motion' in css)
print('has instant screenIn (new):', ('screenIn .18s' in css) or ('screenIn.18s' in css))
