require('dotenv').config();
const { Octokit } = require('@octokit/rest');
const { user_record } = require('NeteaseCloudMusicApi');
const fs = require('fs');
const {
  NETEASE_GIST_ID: gistId,
  GH_TOKEN: githubToken,
  NETEASE_USER_ID: userId,
  NETEASE_USER_TOKEN: userToken,
  NETEASE_MUSIC_START_TAG: startTag,
  NETEASE_MUSIC_END_TAG: endTag,
} = process.env;

(async () => {
  /**
   * First, get user record
   */

  const record = await user_record({
    cookie: `MUSIC_U=${userToken}`,
    uid: userId,
    type: 1, // last week
  }).catch(error => {
    console.error(`Unable to get user record`);
    console.error(error);
  });

  /**
   * Second, get week play data and parse into song/plays diagram
   */

  const { weekData } = record.body;

  const icon = ['🥇', '🥈', '🥉', '🏅', '🏅']

  const lines = weekData.slice(0, 5).reduce((prev, cur, index) => {
    console.log(cur);
    const playCount = cur.playCount;
    const artists = cur.song.ar.map(a => a.name);
    let name = `${cur.song.name} - ${artists.join('/')}`;

    console.log(name);
    console.log(name.length);

    let flag = name.length > 11;
    name = name.slice(0, 11);
    name = flag ? name + '...' : name;

    let tab;
    if (name.length <= 8) {
      tab = '\t\t\t\t';
    } else {
      tab = '\t\t\t';
    }

    const line = [
      icon[index],
      ' ' + name,
      tab,
      `${playCount}`,
      '次    ',
    ];

    return [...prev, line.join('')];
  }, []);

  /**
   * Finally, write into gist
   */

  const title = `🎵 我最近一周的听歌排行`;
  const content = lines.join('\n');
  if (content === '\n\n\n\n') {
    content = 'Oh~我最近还没有听歌～'
  }
  try {
    const octokit = new Octokit({
      auth: `token ${githubToken}`,
    });
    const gist = await octokit.gists.get({
      gist_id: gistId,
    });

    const filename = Object.keys(gist.data.files)[0];
    await octokit.gists.update({
      gist_id: gistId,
      files: {
        [filename]: {
          filename: title,
          content: content,
        },
      },
    });
  } catch (error) {
    console.error(`Unable to update gist\n${error}`);
  }

  // write to markdown
  const markdownFile = process.env.MARKDOWN_FILE;
  const start = startTag === undefined ? '<!-- netease-music-box start -->' : startTag;
  const end = endTag === undefined ? '<!-- netease-music-box end -->' : endTag;
  const markdownTitle = `\n#### <a href="https://gist.github.com/${gistId}" target="_blank">${title}</a>\n`;
  const markdownContent = content;
  if (markdownFile) {
    fs.readFile(markdownFile, 'utf8', (err, data) => {
      if (err) {
        console.error(err);
        return;
      }
      const startIndex = data.indexOf(start) + start.length;
      const endIndex = data.indexOf(end);
      const markdown = data.substring(0, startIndex) + markdownTitle + '```text\n' + markdownContent + '\n```\n\n' + data.substring(endIndex);
      console.log(markdown);
      fs.writeFile(markdownFile, markdown, err => {
        if (err) {
          console.error(err);
          return;
        }
      });
    });
  }

})();
