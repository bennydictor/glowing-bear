import bs4
import os
import requests
import shutil
import json

DIR = 'assets/img/smilies'
try:
    shutil.rmtree(DIR)
except FileNotFoundError:
    pass

os.mkdir(DIR)

soup = bs4.BeautifulSoup(requests.get('https://forums.somethingawful.com/misc.php?action=showsmilies').text, 'lxml')
out = {}
for smilie in soup.select('li.smilie'):
    handle = smilie.div.text
    url = smilie.img['src']
    title = smilie.img['title']
    ext = url.split('.')[-1]
    file = os.path.join(DIR, handle + '.' + ext)
    out[handle] = {'title': title, 'url': file}

    print(handle)
    open(file, 'wb').write(requests.get(url).content)

json.dump(out, open(os.path.join(DIR, "index.json"), 'w'))
