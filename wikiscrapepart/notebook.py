#!/usr/bin/env python
# coding: utf-8

# In[1]:


import requests
import asyncio
import aiohttp
import aiofiles
from bs4 import BeautifulSoup, Comment


# In[3]:


itemurl = "https://wiki.leagueoflegends.com/en-us/Item"
baseurl = "https://wiki.leagueoflegends.com"
ignorecomments = True
discardtags = ["style", "script"]
folderpath = "./html"


# In[21]:


itempage = requests.get(itemurl)


# In[22]:


soup = BeautifulSoup(itempage.content, "html.parser")
item_grid = soup.find("div", id="item-grid")


# In[23]:


categories = ["Starter items", "Basic items", "Epic items", "Legendary items"]
filtered_lists = []

for dl in item_grid.find_all("dl"):
    dt = dl.find("dt")
    if dt and dt.text in categories:
        next_sibling = dl.find_next_sibling("div", class_="tlist")
        if next_sibling:
            filtered_lists.append(next_sibling.find("ul"))


# In[24]:


items = {}

for ul in filtered_lists:
    for div in ul.find_all(
        "div", {"data-modes": lambda x: x and "classic sr 5v5" in x}
    ):
        items[div["data-item"]] = baseurl + div.find("a")["href"]


# In[26]:

itemshtml = {}


def prune_html(rawhtml):
    soup = BeautifulSoup(rawhtml, "lxml")
    if len(discardtags) > 0:  # because soup([]) gets everything
        for element in soup(discardtags):
            element.extract()
    if ignorecomments:
        comments = soup.find_all(string=lambda text: isinstance(text, Comment))
        for comment in comments:
            comment.extract()
    return soup


async def fetch_and_save(session, filename, url):
    async with session.get(url) as response:
        # Check if the request was rate limited
        if response.status == 429:
            print(f"Rate limited on {url}. Retrying after 5 seconds...")
            await asyncio.sleep(5)
            return await fetch_and_save(session, filename, url)
        content = await response.text()
        soup = prune_html(content)
        itemshtml[filename] = soup
    async with aiofiles.open(
        f"{folderpath}/{filename}.html", "w", encoding="utf-8"
    ) as file:
        return await file.write(str(soup))


async def fetch_and_save_all(items):
    async with aiohttp.ClientSession(requote_redirect_url=False) as session:
        tasks = [fetch_and_save(session, item, url) for item, url in items.items()]
        return await asyncio.gather(*tasks)


def init_folder(reset=True):
    import os

    if reset and os.path.exists(folderpath):
        import shutil

        shutil.rmtree(folderpath)
    if not os.path.exists(folderpath):
        os.makedirs(folderpath)


import os

if not os.path.exists(folderpath):
    print("Folder not found, fetching all items")
    init_folder()
    # loop = asyncio.get_event_loop()
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    loop.run_until_complete(fetch_and_save_all(items))
    loop.close()
else:
    print("Folder found, loading all items")
    files = os.listdir(folderpath)
    itemshtml = {}
    for f in files:
        with open(f"{folderpath}/{f}", encoding="utf-8") as file:
            itemshtml[f] = BeautifulSoup(file.read(), "lxml")

base_divs = {}
itemstats = {}

for filename, html_content in itemshtml.items():
    soup = html_content
    base_div = soup.find("div", class_="tabbertab", attrs={"data-title": "Base"})
    aliases = []
    for div in soup.find_all("div", class_="infobox-header"):
        if not base_div and div.get_text(strip=True) == "Stats":
            base_div = div.find_next_sibling("div")
        if div.get_text(strip=True) == "Keywords":
            aliases = [
                a.get_text(strip=True)
                for a in div.find_next_sibling("div").find_all("li")
            ]
    itemstats[filename] = {}
    itemstats[filename]["name"] = filename.split(".html")[0]
    itemstats[filename]["aliases"] = aliases

    cost_label = soup.find("div", class_="infobox-data-label", string="Cost")
    if cost_label:
        cost_value_div = cost_label.find_next_sibling(
            "div", class_="infobox-data-value"
        )
        if cost_value_div:
            cost_span = cost_value_div.find(
                "span", style=lambda s: s and "white-space:normal" in s
            )
            if cost_span:
                cost = cost_span.get_text(strip=True)
                itemstats[filename]["cost"] = cost

    base_divs[filename] = base_div


# In[65]:


relevantstats = [
    "attack damage",
    "armor penetration",
    "lethality",
    "critical strike chance",
]
for item, base_div in base_divs.items():
    if not base_div:
        print(item)
        print(itemshtml[item].prettify())
    stats = {}
    statlist = base_div.find_all("div", class_="infobox-data-value")
    for relevantstat in relevantstats:
        stats[relevantstat] = 0
    for stathtml in statlist:
        stattext = stathtml.text
        statval = stattext.split(" ")[0]
        statname = stattext[len(statval) + 1 :]
        if statname in relevantstats:
            if "%" in statval:
                stats[statname] = float(statval.replace("%", "e-2")[1:])
            else:
                stats[statname] = int(statval[1:])
    itemstats[item].update(stats)


# In[79]:


itemstrlist = [
    f'new Item("{item["name"]}", {item["cost"]}, {item["attack damage"]}, {item["critical strike chance"]}, {"true" if item["name"] == "Infinity Edge" else "false"}, {item["lethality"]}, {item["armor penetration"]}, {str(item["aliases"])}),'
    for item in itemstats.values()
]

out = (
    """import { Item } from "../classes/Item";

export const ALL_ITEMS = [
    """
    + "\n    ".join(itemstrlist)
    + "\n];\n"
)

with open("Items.ts", "w") as f:
    f.write(out)
