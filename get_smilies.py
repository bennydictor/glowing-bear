import requests

import bs4
import json

import io
import zipfile

import logging
import os
import shutil
import subprocess
import sys


log = logging.getLogger(__name__)

SMILIES_DIR = 'assets/img/smilies'


def clean_smilies_dir():

    try:
        shutil.rmtree(SMILIES_DIR)
    except FileNotFoundError:
        pass

    os.mkdir(SMILIES_DIR)


def fetch_sa_smilies():

    index = {}

    log.info('Downloading SA smilies')
    r = requests.get('https://forums.somethingawful.com/misc.php?action=showsmilies')
    soup = bs4.BeautifulSoup(r.content, 'lxml')

    for smilie in soup.select('li.smilie'):

        handle = smilie.div.text
        url = smilie.img['src']
        title = smilie.img['title']
        ext = url.split('.')[-1]

        file = os.path.join(SMILIES_DIR, f'{handle}.{ext}')

        r = requests.get(url)
        open(file, 'wb').write(r.content)

        index[handle] = {'title': title, 'url': f'/{file}'}
        log.info(f'Downloaded {handle}')

    return index

def fetch_pidgin_smilies():

    index = {}

    log.info('Downloading pidgin smilies')
    r = requests.get('https://s3.amazonaws.com/emotes.gbs.io/pidgin.zip')

    with zipfile.ZipFile(io.BytesIO(r.content)) as zf:

        theme_file = zf.open('pidgin/theme')
        lines = (line.decode() for line in iter(theme_file))

        for line in lines:
            if line.strip() == '[default]':
                break

        for line in lines:

            filename, handle = line.strip().split()
            ext = filename.split('.')[-1]

            file = os.path.join(SMILIES_DIR, f'{handle}.{ext}')

            content = zf.open(f'pidgin/{filename}').read()
            open(file, 'wb').write(content)

            index[handle] = {'title': '', 'url': f'/{file}'}
            log.info(f'Downloaded {handle}')

    return index

def fetch_custom_smilies():

    try:
        return json.load(open('assets/img/custom-smilies/index.json'))
    except FileNotFoundError:
        return {}


if __name__ == '__main__':

    logging.getLogger().setLevel(logging.ERROR)

    logging.getLogger('requests').setLevel(logging.WARN)
    logging.getLogger(__name__).setLevel(logging.INFO)

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter('[%(asctime)s] (%(levelname)s) %(name)s: %(message)s'))
    logging.getLogger().addHandler(handler)

    clean_smilies_dir()

    smilies_index = {}
    smilies_index.update(fetch_pidgin_smilies())
    smilies_index.update(fetch_sa_smilies())
    smilies_index.update(fetch_custom_smilies())

    escaped_json = json.dumps(smilies_index).replace('\\', '\\\\').replace('/', '\\/')
    subprocess.run(['sed', f's/^var smiliesIndex = .*$/var smiliesIndex = {escaped_json};/', '-i', 'js/filters.js'])
