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

const info = require('./media/visa.json');

const url = 'https://content.jwplatform.com/videos/L0jBTtHF-96F1EhHl.mp4';

/*
 * htmltopdf: https://www.npmjs.com/package/html2pdf.js
 */

async function test() {
    let result = await ai.getDivinciResponse('What color is the sky?');

    console.log('result', result);
}
test();

const sleep = seconds => new Promise(r => setTimeout(r, seconds * 1000));

async function doStuff() {
    
    const fileName = `./media/${uuidv4()}.mp4`;
    console.log('downloading', fileName);
    await axiosTools.urlToFile(url, fileName)
    console.log('converting to mp3')
    const mp3File = await deepgram.convertMp4ToMp3(fileName);
    let loc = mp3File.indexOf('.mp3');
    if (loc === -1) return false;
    const jsonFile = mp3File.substring(0, loc) + '.json';
    // console.log("transcribing the mp3 into raw words");
    //const info = await deepgram.transcribeRecording(mp3File, jsonFile);

    if (info) {
        console.log('generating raw transcript', mp3File);
        let rawTranscript = deepgram.generateSpeakerBasedTranscript(info);

        console.log('splitting raw transcript into speaker-based paragraphs');
        let speakerChunks = deepgram.getSpeakerChunks(rawTranscript);
        rawTranscript = '';


        console.log('creating AI-ready transcript chunks')
        let transcriptChunks = deepgram.getTranscriptChunks(speakerChunks);
        speakerChunks = null;

        console.log('assigning speakers to AI chunks');
        let speakerAssignedChunks = [];
        for (let i = 0; i < transcriptChunks.length; ++i) {
            speakerAssignedChunks.push(deepgram.assignSpeakers(transcriptChunks[i], speakers));
        }
        transcriptChunks = null;

        const cleanedChunks = [];
        for (let i = 0; i < speakerAssignedChunks.length; ++i) {
            console.log(`Using AI to clean up imperfections in transcript chunk #${i+1}. This can take several minutes.`);
            let result;
            /*
             * IMPORTANT: check if response is serverTooBusy and retry after n minutes where n doubles each time.
             * Send message, ChatGPT Server is Overloaded. Will retry in __ seconds (with countdown)
             */

            result = await ai.cleanTranscriptChunk(speakerAssignedChunks[i]);
            let count = 0;
            let seconds = 30;
            const maxCount = 5;
            while (result.status === 'error') {
                seconds *= 2;
                ++count;
                if (count >= maxCount) return console.error(JSON.stringify(result.message,null, 4));
                console.log(`ChatGPT Error. Waiting ${seconds} seconds and then trying again.`);
                await sleep(seconds);
                result = await ai.cleanTranscriptChunk(speakerAssignedChunks[i]);
            }
            
            cleanedChunks.push(result.content);
        }

        speakerAssignedChunks = null;

        let article;
        if (cleanedChunks.length === 1) {
            console.log(`Using AI to write the article. This can take several minutes.`);
            let result = await ai.fullArticle(cleanedChunks[0]);
            let count = 0;
            let seconds = 30;
            const maxCount = 5;
            while (result.status === 'error') {
                seconds *= 2;
                ++count;
                if (count >= maxCount) return console.error(JSON.stringify(result.message,null, 4));
                console.log(`ChatGPT Error. Waiting ${seconds} seconds and then trying again.`);
                await sleep(seconds);
                result = await ai.fullArticle(cleanedChunks[0]);
            }
            
            article = result.content;
            console.log(article);
        } else {
            for (let i = 0; i < cleanedChunks.length; ++i) {
                console.log(`Using AI to write the article based on chunk #${i+1}. This can take several minutes.`);
                if (i === 0) {
                    let result = await ai.startArticle(cleanedChunks[i]);
                    let count = 0;
                    let seconds = 30;
                    const maxCount = 5;
                    while (result.status === 'error') {
                        seconds *= 2;
                        ++count;
                        if (count >= maxCount) return console.error(JSON.stringify(result.message,null, 4));
                        console.log(`ChatGPT Error. Waiting ${seconds} seconds and then trying again.`);
                        await sleep(seconds);
                        result = await ai.startArticle(cleanedChunks[i]);
                    }
                    
                    article = result.content;
                    
                } else {
                    let result;
                    if (i === cleanedChunks.length - 1 ) result = await ai.endArticle(cleanedChunks[i]);
                    else result = await ai.continueArticle(cleanedChunks[i]);
                    let count = 0;
                    let seconds = 30;
                    const maxCount = 5;
                    while (result.status === 'error') {
                        seconds *= 2;
                        ++count;
                        if (count >= maxCount) return console.error(JSON.stringify(result.message,null, 4));
                        console.log(`ChatGPT Error. Waiting ${seconds} seconds and then trying again.`);
                        await sleep(seconds);
                        if (i === cleanedChunks.length - 1 ) result = await ai.endArticle(cleanedChunks[i]);
                        else result = await ai.continueArticle(cleanedChunks[i]);
                    }
                    
                    article += result.content;
                }
            }
        }

        
        // Generate list of 10 titles

        // getTags

        // Post to WordPress 
        
        
        // create article

        //console.log(transcript);
    }
    
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
    
    const fileName = `./media/${uuidv4()}.mp4`;
    const videoName = url.substring(url.lastIndexOf('/')+1);
    socket.emit('message', `Downloading: ${videoName}`)
 
    try {
        await axiosTools.urlToFile(url, fileName)
    } catch (err) {
        console.error(err);
        return socket.emit('error', `Could not download ${videoName}. Please try again later.`)
    }
    socket.emit('message', `Converting ${videoName} to mp3`);

    let mp3File;
    try {
        mp3File = await deepgram.convertMp4ToMp3(fileName);
    } catch (err) {
        console.error(err);
        return socket.emit('error', `Could not convert ${videoName} to mp3.`)
    }
    
    let loc = mp3File.indexOf('.mp3');
    if (loc === -1) return socket.emit('error', `Could not convert ${videoName} to mp3.`);
    
    const jsonFile = mp3File.substring(0, loc) + '.json';
    // console.log("transcribing the mp3 into raw words");
    //const info = await deepgram.transcribeRecording(mp3File, jsonFile);

    if (!info) return socket.emit('error', 'Could not transcribe the video.');

    const speakers = deepgram.getSpeakers(info);
    socket.emit('speakers', speakers);

    socket.emit('message', 'Generating raw transcript.');
    let rawTranscript = deepgram.generateSpeakerBasedTranscript(info);
    socket.rawTranscript = rawTranscript;

    socket.emit('transcript', rawTranscript);
    socket.emit('done', 'ready for speaker input');

    return;

    //console.log('urlInfo', urlInfo);
}

const handleSpeakers = async (socket, speakerList) => {
    console.log('got speakers', speakerList);
    socket.emit('gotSpeakers', 'got them');

    socket.emit ('message', 'Assigning speakers to transcript.');
    
    let speakerChunks = deepgram.getSpeakerChunks(socket.rawTranscript);
    delete socket.rawTranscript;

    let transcriptChunks = deepgram.getTranscriptChunks(speakerChunks);
    speakerChunks = null;

    let speakerAssignedChunks = [];
    for (let i = 0; i < transcriptChunks.length; ++i) {
        speakerAssignedChunks.push(deepgram.assignSpeakers(transcriptChunks[i], speakerList));
    }
    socket.emit('transcript', speakerAssignedChunks.join("\n"));

    transcriptChunks = null;

    const cleanedChunks = [];
    for (let i = 0; i < speakerAssignedChunks.length; ++i) {
        socket.emit('message',`Using AI to clean up imperfections in transcript chunk #${i+1} of ${speakerAssignedChunks.length}. This can take several minutes.`);
        let result;
        
        result = await ai.cleanTranscriptChunk(speakerAssignedChunks[i], socket);
        
        if (result.status === 'error') return socket.emit('error', 'ChatGPT servers are down. Please try again later.');
        
        cleanedChunks.push(result.content);
        socket.emit('transcript', cleanedChunks.join("\n"));
    }

    speakerAssignedChunks = null;

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



