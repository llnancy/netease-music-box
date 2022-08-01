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

  let totalPlayCount = 0;
  const { weekData } = record.body;
  weekData.forEach(data => {
    totalPlayCount += data.playCount;
  });

  console.log(weekData);

  const icon = ['🥇', '🥈', '🥉', '🏅', '🏅']

  const lines = weekData.slice(0, 5).reduce((prev, cur, index) => {
    const playCount = cur.playCount;
    const artists = cur.song.ar.map(a => a.name);
    let name = `${cur.song.name} - ${artists.join('/')}`;

    const line = [
      icon[index],
      name,
      '\t\t\t',
      `${playCount}`,
      '次    ',
    ];
    let join = line.join('  ');
    console.log(join);
    console.log(join.length);

    return [...prev, line.join(' ')];
  }, []);

  /**
   * Finally, write into gist
   */

  const title = `🎵 我最近一周的听歌排行`;
  const content = lines.join('\n');
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
