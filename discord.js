const Discord = require('discord.js');
const client = new Discord.Client();
const setting = require('./setting.json');
const PREFIX = "!"
const YouTube = require('discord-youtube-api');
const youtube = new YouTube(setting.yToken); //유튜브 api 토큰
const ytdl = require('ytdl-core');

const queue = new Map()


////////////////////////////////
const express = require('express');
const server = express();

function keepAlive(){
    server.listen(3000, ()=>{console.log("Server is Ready!" + Date.now()) });
}

keepAlive();

/////////////////////////////
client.on("ready", () => {
    console.log(`${client.user.tag} 로그인 되었습니다.`);
    client.user.setActivity(setting.Status, { type: "PLAYING"}); //PLAYING, WATCHING, LISTENING, STREAMING 디스코드 상태 설정
});


client.on('message', async msg => {
    console.log(msg);
    if(msg.author.bot) return
    if (!msg.content.startsWith(PREFIX)) return

    // const msgprefix = msg.content.slice(prefix.length);
    // const args = msgprefix.split(' ');
    // const msg1 = args.shift().toLowerCase();
    // const embed = new Discord.MessageEmbed();
    // const args2 = msgprefix[1] ? msgprefix[1].replace(/<(.+)>/g, "$1") : ""
    // const url = args2.toString();
    // const serverQueue = queue.get(msg.id); // msg.guild.id
    const args = msg.content.substring(PREFIX.length).split(" ")
    const searchString = args.slice(1).join(' ')
    const url = args[1] ? args[1].replace(/<(.+)>/g, '$1') : ""
    const serverQueue = queue.get(msg.guild.id)
    const embed = new Discord.MessageEmbed();

    if (msg.content.startsWith(`${PREFIX}help`) || msg.content.startsWith(`${PREFIX}도움말`)|| msg.content.startsWith(`${PREFIX}명령어`)) {
      embed.setTitle("사용설명서")
      embed.setColor("0f4c81")
      embed.setDescription("사용법 : !명령어 입니다. 자세한 명령어는 천천히 알아가주세요~");
      msg.channel.send(embed);
    }

    if(msg.content.startsWith(`${PREFIX}프사`)) {
      msg.channel.send(msg.author.displayAvatarURL());
    }

    if(msg.content.startsWith(`${PREFIX}재생`)) { //play
    const voiceChannel = msg.member.voice.channel
      if(!voiceChannel) 
      return msg.channel.send("당신이 음성채널에 들어가 있어야합니다!")
      const permissions = voiceChannel.permissionsFor(msg.client.user)
      if(!permissions.has('CONNECT')) 
      return msg.channel.send("음성채널에 연결할 권한이 없습니다.")
      if(!permissions.has('SPEAK')) 
      return msg.channel.send("채널에서의 발언권이 없습니다.")

      if(url.match(/^https?:\/\/(www.youtube.com|youtube.com)\/playlist(.*)$/)) {
          const playList = await youtube.getPlaylist(url)
          const videos = await playList.getVideos()
          for (const video of Object.values(videos)) {
              const video2 = await youtube.getVideoByID(video.id)
              await handleVideo(video2, msg, voiceChannel, true)
          }
          msg.channel.send(`플레이리스트 **${playList.title}** 는 목록에 추가되었습니다.`)
          return undefined
      } else {
          try{
              var video = await youtube.getVideo(url)
          } catch {
              try {
                  var videos = await youtube.searchVideos(searchString, 10)
                  var index = 0
                  msg.channel.send(`__**Song Selection:**__${videos.map(video2 => `**${++index} -** ${video2.title}`).join('\n')}1 ~ 10 개의 노래 중 하나를 선택하세요.`)
                  try {
                      var responce = await msg.channel.awaitmsgs(msg => msg.content > 0 && msg.content < 11, {
                          max: 1,
                          time: 30000,
                          errors: ['time']
                      })
                  } catch {
                      msg.channel.send(`No or invalid song selection was provided`)
                  }
                  const videoIndex = parseInt(responce.first().content)
                  var video = await youtube.getVideoByID(videos[videoIndex - 1].id)
              } catch {
                  return msg.channel.send("검색결과를 찾을수 없습니다.")
              }
          }
          return handleVideo(video, msg, voiceChannel)
      }
        } else if (msg.content.startsWith(`${PREFIX}정리`)) {
            if(!msg.member.voice.channel) 
            return msg.channel.send("음악을 중지하려면 음성채널에 있어야합니다")
            if(!serverQueue) 
            return msg.channel.send("아무것도 재생되고 있지 않습니다.")
            serverQueue.songs = []
            serverQueue.connection.dispatcher.end()
            msg.channel.send("재생되고 있는 음악을 멈췄습니다.")
            return undefined
        } else if (msg.content.startsWith(`${PREFIX}스킵`)) {
            if(!msg.member.voice.channel) 
            return msg.channel.send("You need to be in a voice channel to skip the music")
            if(!serverQueue) return msg.channel.send("아무것도 재생되고 있지 않습니다.")
            serverQueue.connection.dispatcher.end()
            msg.channel.send("당신을 위해 음악을 넘겼어요.")
            return undefined
        } else if (msg.content.startsWith(`${PREFIX}볼륨`)) {
            if(!msg.member.voice.channel) 
                return msg.channel.send("음악 명령을 사용하려면 음성채널에 있어야 합니다.")
            if(!serverQueue) 
                return msg.channel.send("아무것도 재생되고 있지 않습니다.")
            if(!args[1]) 
                return msg.channel.send(`볼륨: **${serverQueue.volume}**`)
            if(isNaN(args[1])) 
                return msg.channel.send("볼륨을 바꿀수있는 유효수치가 아닙니다.")
            serverQueue.volume = args[1]
            serverQueue.connection.dispatcher.setVolumeLogarithmic(args[1] / 5)
            msg.channel.send(`볼륨을 다음으로 변경하였습니다: **${args[1]}**`)
            return undefined
        } else if (msg.content.startsWith(`${PREFIX}np`)) {
            if(!serverQueue) return msg.channel.send("아무것도 재생되고 있지 않습니다.")
                msg.channel.send(`지금 재생중: **${serverQueue.songs[0].title}**`)
            return undefined
        } else if (msg.content.startsWith(`${PREFIX}queue`)) {
            if(!serverQueue) return msg.channel.send("아무것도 재생되고 있지 않습니다.")
                msg.channel.send(`
            __**노래 대기열:**__
        ${serverQueue.songs.map(song => `**-** ${song.id} - Request by ${msg.author.tag}`).join('\n')}
        **재생중:** ${serverQueue.songs[0].title}
            `, { split: true })
            return undefined
        } else if (msg.content.startsWith(`${PREFIX}정지`)) {
            if(!msg.member.voice.channel) return msg.channel.send("일시정지 명령을 사용하려면 음성채널에  있어야 합니다.")
            if(!serverQueue) return msg.channel.send("아무것도 재생되고 있지 않습니다.")
            if(!serverQueue.playing) return msg.channel.send("음악이 이미 일시정지 되어있습니다.")
            serverQueue.connection.dispatcher.pause()
            msg.channel.send("당신을 위해 음악을 일시정지 했습니다.")
            return undefined
        } else if (msg.content.startsWith(`${PREFIX}resume`)) {
            if(!msg.member.voice.channel) return msg.channel.send("다시 재생 명령어를 사용하려면 음성채널에 있어야 합니다.")
            if(!serverQueue) return msg.channel.send("아무것도 재생되고 있지 않습니다.")
            if(serverQueue.playing) return msg.channel.send("음악이 이미 재생중입니다.")
            serverQueue.playing = true
            serverQueue.connection.dispatcher.resume()
            msg.channel.send("당신을 위해 음악을 다시 재생되고 있습니다.")
            return undefined
        } else if (msg.content.startsWith(`${PREFIX}반복`)) {
            if(!msg.member.voice.channel) return msg.channel.send('이 명령어를 사용하려면 음성채널에 있어야 합니다.')
            if(!serverQueue) return msg.channel.send('아무것도 재생되고 있지 않습니다.')

            serverQueue.loop = !serverQueue.loop

            return msg.channel.send(`I have now ${serverQueue.loop ? `**Enabled**` : `**Disable**`} loop.`)
        } else if (msg.content.startsWith(`${PREFIX}노래`)) {
            msg.channel.send({embed: {
                color: 3447003,
                author: {
                    name: client.user.username,
                    icorn_url: client.user.avatarURL
                },
                title: "노래 재생 명령어",
                description: "!재생 (;p)\n!정지\n!resume\n스킵 (!s)\n!loop\n!볼륨\n",
                timestamp: new Date(),
                footer: {
                    icorn_url: client.user.avatarURL,
                    text: "ⓒ Naka"
                },
                //https://github.com/AnIdiotsGuide/discordjs-bot-guide/blob/master/first-bot/using-embeds-in-msgs.md
            }
    })  
        } else if (msg.content.startsWith(`${PREFIX}재생`)) {
            const voiceChannel = msg.member.voice.channel
            if(!voiceChannel) return msg.channel.send("당신이 음성채널에 들어가 있어야합니다!")
            const permissions = voiceChannel.permissionsFor(msg.client.user)
            if(!permissions.has('CONNECT')) return msg.channel.send("음성채널에 연결할 권한이 없습니다.")
            if(!permissions.has('SPEAK')) return msg.channel.send("채널에서의 발언권이 없습니다.")

            if(url.match(/^https?:\/\/(www.youtube.com|youtube.com)\/playlist(.*)$/)) {
                const playList = await youtube.getPlaylist(url)
                const videos = await playList.getVideos()
                for (const video of Object.values(videos)) {
                    const video2 = await youtube.getVideoByID(video.id)
                    await handleVideo(video2, msg, voiceChannel, true)
                }
                msg.channel.send(`플레이리스트 **${playList.title}** 는 목록에 추가되었습니다.`)
                return undefined
            } else {
                try{
                    var video = await youtube.getVideo(url)
                } catch {
                    try {
                        var videos = await youtube.searchVideos(searchString, 10)
                        var index = 0
                        msg.channel.send(`__**Song Selection:**__${videos.map(video2 => `**${++index} -** ${video2.title}`).join('\n')}Please select one of the songs ranging from 1-10`)
                        try {
                            var responce = await msg.channel.awaitmsgs(msg => msg.content > 0 && msg.content < 11, {
                                max: 1,
                                time: 30000,
                                errors: ['time']
                            })
                        } catch {
                            msg.channel.send(`No or invalid song selection was provided`)
                        }
                        const videoIndex = parseInt(responce.first().content)
                        var video = await youtube.getVideoByID(videos[videoIndex - 1].id)
                    } catch {
                        return msg.channel.send("검색결과를 찾을수 없습니다.")
                    }
                }
                return handleVideo(video, msg, voiceChannel)
            }
        } else if (msg.content.startsWith(`${PREFIX}정지`)) {
            if(!msg.member.voice.channel) return msg.channel.send("You need to be in a voice channel to skip the music")
            if(!serverQueue) return msg.channel.send("아무것도 재생되고 있지 않습니다.")                
            serverQueue.connection.dispatcher.end()
            msg.channel.send("당신을 위해 음악을 넘겼어요.")
            return undefined
        }
        switch (msg.content.startsWith(`${PREFIX}${args}`)){
            case "안녕하세요":
            case "안녕":
            case "ㅎㅇ":
            case "ㅎㅇㅎㅇ":
            case "ㅎ2": 
                msg.reply("안냥~♥");
                break;
            case "잘자": 
                msg.reply("굿냐앙~:zzz:");
                break;
            case "사랑해":
                msg.reply("나도 정말사랑해~♥");
                break;
            case "플레이리스트": 
                embed.setTitle("플레이리스트");
                embed.setColor("0f4c81");
                embed.setDescription("1. 요아소비 2. 요루시카");
                msg.channel.send(embed);
                break;
            case "요아소비": 
                msg.reply("https://www.youtube.com/watch?v=NyUTYwZe_l4");
                break;
            case "猫":
            case "dish":
                msg.reply("https://www.youtube.com/watch?v=gsT6eKsnT0M");
                break;
            case "뭐해?":
            case "뭐해" :
                msg.reply("누구세요?");
                break;  
        }
});

async function handleVideo(video, msg, voiceChannel, playList = false) {
  const serverQueue = queue.get(msg.guild.id)//msg.guild.id
  const song = {
      id: video.title,
      //title: Util.escapeMarkdown(video.title),
      url: `https://www.youtube.com/watch?v=${video.id}`
  }

  if(!serverQueue) {
      const queueConstruct = {
          textChannel: msg.channel,
          voiceChannel: voiceChannel,
          connection: null,
          songs: [],
          volume: 5,
          playing: true,
          loop: false,
      }
      queue.set(msg.guild.id, queueConstruct)

      queueConstruct.songs.push(song)

      try {
          var connection = await voiceChannel.join()
          queueConstruct.connection = connection
          play(msg.guild, queueConstruct.songs[0])
      } catch (error) {
          console.log(`음성채널 연결중 오류가 발생하였습니다: ${error}`)
          queue.delete(msg.guild.id)
          msg.channel.send(`음성채널 연결중 오류가 발생하였습니다: ${error}`)
      }

  } else {
      serverQueue.songs.push(song)
      if (playList) return undefined
      else return msg.channel.send(`**${song.id}** 이 대기열에 추가되었습니다.`)
  }
  return undefined
}

function play(guild, song) {
  const serverQueue = queue.get(guild.id)

  if(!song) {
      serverQueue.voiceChannel.leave()
      queue.delete(guild.id)
      return
  }

  const dispatcher = serverQueue.connection.play(ytdl(song.url))
  .on('finish', () => {
      if (!serverQueue.loop) serverQueue.songs.shift()
      play(guild, serverQueue.songs[0])
  })
  .on('error', error => {
      console.log(error)
  })
  dispatcher.setVolumeLogarithmic(serverQueue.volume / 5)

  serverQueue.textChannel.send(`재생시작: **${song.id}**`)
}
client.login(setting.token); //디스코드 봇 토큰설정