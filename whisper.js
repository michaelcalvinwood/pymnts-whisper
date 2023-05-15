const httpsPort = 6400;
const privateKeyPath = '/etc/letsencrypt/live/node.pymnts.com/privkey.pem';
const fullchainPath = '/etc/letsencrypt/live/node.pymnts.com/fullchain.pem';

const { v4: uuidv4 } = require('uuid');

const media = require('./utils/media');
const ai = require('./utils/ai');
const deepgram = require('./utils/deepgram');
const axiosTools = require('./utils/axios');
const express = require('express');
const https = require('https');
const cors = require('cors');
const fs = require('fs');

const app = express();
app.use(express.static('public'));
app.use(express.json({limit: '200mb'})); 
app.use(cors());

const cleanedChunksJSON = require('./cleanedChunks.json');

const createArticleFromCleanedChunks = async () => {
    let cleanedChunks = cleanedChunksJSON;
    let article;
    let result;
    let curArticleChunk;
    if (cleanedChunks.length === 1) {
        result = await ai.fullArticle(cleanedChunks[0]);
        article = result.content;
    } else {
        for (let i = 0; i < cleanedChunks.length; ++i) {
            console.log('message', `Using AI to write the article based on chunk #${i+1} of ${cleanedChunks.length}. This can take several minutes.`);
            if (i === 0) {
                result = await ai.startArticle(cleanedChunks[i]);
                console.log('startArticle', result.content);
                article = result.content;
            } else {
                if (i === cleanedChunks.length - 1 ) {
                    result = await ai.endArticle(cleanedChunks[i], curArticleChunk);
                   // console.log(result);
                    console.log('endArticle', result.content);
                }
                else {
                    result = await ai.continueArticle(cleanedChunks[i], curArticleChunk);
                    console.log('continueArticle', result.content);
                }
                article += result.content;
            }
            curArticleChunk = result.content;
        }
        
    }
}
//createArticleFromCleanedChunks();

// const info = require('./media/visa.json');

const url = 'https://content.jwplatform.com/videos/L0jBTtHF-96F1EhHl.mp4';

/*
 * htmltopdf: https://www.npmjs.com/package/html2pdf.js
 */

async function test() {
    let cleanedChunks = fs.readFileSync('./cleanedChunks.json', 'utf-8');
    cleanedChunks = JSON.parse(cleanedChunks);

    speakerAssignedChunks = null;

    //console.log('cleanedChunks', cleanedChunks);
    console.log('testing');

    let article;
    if (cleanedChunks.length === 1) {
        let result = await ai.fullArticle(cleanedChunks[0]);
        article = result.content;
        socket.emit('article', article);
    } else {
        for (let i = 0; i < cleanedChunks.length; ++i) {
            if (i === 0) {
                let result = await ai.startArticle(cleanedChunks[i]);
                console.log('result.content', result.content);
                article = result.content;
            } else {
                let result;
                if (i === cleanedChunks.length - 1 ) result = await ai.endArticle(cleanedChunks[i], article);
                else result = await ai.continueArticle(cleanedChunks[i]);
                console.log('result.content', result.content);
                article += result.content;
            }
            break;
        }
    }
}
//test();

const sleep = seconds => new Promise(r => setTimeout(r, seconds * 1000));


const downloadMp4 = async url => {
    const fileName = `./media/${uuidv4()}.mp4`;
    const videoName = url.substring(url.lastIndexOf('/')+1);

    try {
        await axiosTools.urlToFile(url, fileName)
    } catch (err) {
        console.error(err);
        return false;
    }
    return fileName;
}

const convertMp4ToMp3 = async fileName => {
    let mp3File;
    try {
        mp3File = await deepgram.convertMp4ToMp3(fileName);
    } catch (err) {
        console.error(err);
        return false;
    }
    
    let loc = mp3File.indexOf('.mp3');
    if (loc === -1) return false;

    return mp3File
}

const handleUrl = async (socket, url) => {
    console.log('the url is ', url);


    let urlInfo;
    try {
        urlInfo = new URL(url);
    } catch (err) {
        return socket.emit('error', 'invalid url');
    }

    const extension = url.substring(url.lastIndexOf('.'));

    if (extension !== '.mp4') return socket.emit('error', 'URL is not .mp4');
    
    socket.emit('message', `Downloading video`)
    const fileName = await downloadMp4(url);
    if (!fileName) return socket.emit('error', `Could not download video. Please try again later.`)
    
    socket.emit('message', `Converting video file into an audio file.`);

    let mp3File = await convertMp4ToMp3(fileName);
    if (mp3File === false) socket.emit('error', `Could not convert videot to audio file.`);

    let loc = mp3File.indexOf('.mp3');
    const jsonFile = mp3File.substring(0, loc) + '.json';
   
    socket.emit ("Transcribing the audio file into raw words.");
    const info = await deepgram.transcribeRecording(mp3File, jsonFile);
    if (!info) return socket.emit('error', 'Could not transcribe the video.');

    const speakers = deepgram.getSpeakers(info);
    socket.emit('speakers', speakers);

    socket.emit('message', 'Generating raw transcript.');
    let rawTranscript = deepgram.generateSpeakerBasedTranscript(info);
    console.log('rawTranscript', rawTranscript);

    socket.emit('transcript', rawTranscript);
    socket.emit('rawTranscript', rawTranscript);
    socket.emit('done', 'ready for speaker input');
    return;

    //console.log('urlInfo', urlInfo);
}

const handleSpeakers = async (socket, info) => {
    const { rawTranscript, speakerList } = info;
    console.log('handleSpeakers', rawTranscript);

    socket.emit('gotSpeakers', 'got them');

    socket.emit ('message', 'Assigning speakers to transcript.');
    
    let speakerChunks = deepgram.getSpeakerChunks(rawTranscript);

    console.log('speakerChunks', speakerChunks)

    let transcriptChunks = deepgram.getTranscriptChunks(speakerChunks);
    speakerChunks = null;

    let speakerAssignedChunks = [];
    for (let i = 0; i < transcriptChunks.length; ++i) {
        speakerAssignedChunks.push(deepgram.assignSpeakers(transcriptChunks[i], speakerList));
    }
    socket.emit('transcript', speakerAssignedChunks.join("\n"));

    console.log('speakerAssignedChunks', speakerAssignedChunks);

    transcriptChunks = null;

    const cleanedChunks = [];

    for (let i = 0; i < speakerAssignedChunks.length; ++i) {
        socket.emit('message',`Using AI to clean up imperfections in transcript chunk #${i+1} of ${speakerAssignedChunks.length}. This can take several minutes.`);
        let result;
        
        result = await ai.cleanTranscriptChunk(speakerAssignedChunks[i], 'turbo', socket);
        
        if (result.status === 'error') return socket.emit('error', 'ChatGPT servers are down. Please try again later.');
        console.log(`Cleaned Chunk #${i+1} of ${speakerAssignedChunks.length}`, result);
        cleanedChunks.push(result.content);
        fs.writeFileSync(`transcriptChunk${i+1}.txt`, result.content);
        socket.emit('transcript', cleanedChunks.join("\n"));
    }

    fs.writeFileSync('cleanedChunks.json', JSON.stringify(cleanedChunks));
    fs.writeFileSync('cleanedTranscript.txt', cleanedChunks.join("\n"));
    
    // return socket.emit('message', "chunks ready for debugging");

    // let cleanedChunks = fs.readFileSync('./cleanedChunks.json', 'utf-8');
    // cleanedChunks = JSON.parse(cleanedChunks);

    speakerAssignedChunks = null;

    console.log('cleanedChunks', cleanedChunks);

    let article;
    if (cleanedChunks.length === 1) {
        socket.emit('message', `Using AI to write the article. This can take several minutes.`);
        let result = await ai.fullArticle(cleanedChunks[0]);
        article = result.content;
        socket.emit('article', article);
    } else {
        for (let i = 0; i < cleanedChunks.length; ++i) {
            socket.emit('message', `Using AI to write the article based on chunk #${i+1} of ${cleanedChunks.length}. This can take several minutes.`);
            if (i === 0) {
                let result = await ai.startArticle(cleanedChunks[i]);
                console.log('result.content', result.content);
                article = result.content;
                socket.emit('article', article);
            } else {
                let result;
                if (i === cleanedChunks.length - 1 ) result = await ai.endArticle(cleanedChunks[i], article);
                else result = await ai.continueArticle(cleanedChunks[i]);
                console.log('result.content', result.content);
                article += result.content;
                socket.emit('article', article);
            }
        }
    }

    socket.emit('done', 'articleComplete');
}

const socketConnection = socket => {

    console.log('connection', socket.id);

    socket.on('url', (url) => handleUrl(socket, url));
    socket.on('speakers', (speakerList) => handleSpeakers(socket, speakerList));
}

app.get('/', (req, res) => {
    res.send('Hello, World!');
});

const httpsServer = https.createServer({
    key: fs.readFileSync(privateKeyPath),
    cert: fs.readFileSync(fullchainPath),
  }, app);

const io = require('socket.io')(httpsServer, {
    cors: {
      origin: "http://localhost:3000",
      methods: ["GET", "POST"]
    }
  });

io.on('connection', socket => {
    socketConnection(socket);
    // client.on('connection', (socket) => socketConnection(socket));
    // client.on('event', data => { console.log(data) });
    // client.on('disconnect', () => { console.log('disconnected', client.id)});
});

httpsServer.listen(httpsPort,  () => {
    console.log(`HTTPS Server running on port ${httpsPort}`);
});



