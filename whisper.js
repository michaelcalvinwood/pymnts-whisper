const httpsPort = 6400;
const privateKeyPath = '/etc/letsencrypt/live/node.pymnts.com/privkey.pem';
const fullchainPath = '/etc/letsencrypt/live/node.pymnts.com/fullchain.pem';

const { v4: uuidv4 } = require('uuid');
const formidable = require('formidable');

const media = require('./utils/media');
const ai = require('./utils/ai');
const deepgram = require('./utils/deepgram');
const axiosTools = require('./utils/axios');
const express = require('express');
const https = require('https');
const cors = require('cors');
const fs = require('fs');

const s3 = require('./utils/s3');

const app = express();
app.use(express.static('public'));
app.use(express.json({limit: '999mb'})); 
app.use(cors());

const cleanedChunksJSON = require('./cleanedChunks.json');

const sockets = {}; // sockets[id] = socket; ?s={socketId}

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

const processAudioFile = async (audioFile, socket) => {
    let loc = audioFile.lastIndexOf('.');
    const jsonFile = audioFile.substring(0, loc) + '.json';
   
    socket.emit ('message', "Transcribing the audio file into raw words.");
    const info = await deepgram.transcribeRecording(audioFile, jsonFile);
    if (!info) return socket.emit('error', 'Could not transcribe the video.');

    const speakers = deepgram.getSpeakers(info);
    socket.emit('speakers', speakers);

    socket.emit('message', 'Generating raw transcript.');
    let rawTranscript = deepgram.generateSpeakerBasedTranscript(info);
    console.log('rawTranscript', rawTranscript);

    socket.emit('transcript', rawTranscript);
    socket.emit('rawTranscript', rawTranscript);
    socket.emit('done', 'ready for speaker input');
}

const processMp4File = async (fileName, socket) => {
    socket.emit('message', `Converting video file into an audio file.`);

    let mp3File = await convertMp4ToMp3(fileName);
    if (mp3File === false) socket.emit('error', `Could not convert video to audio file.`);
    
    await processAudioFile(mp3File, socket);
    
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

    await processMp4File(fileName, socket);
    return;

    //console.log('urlInfo', urlInfo);
}



const getCurrentSpeaker = (paragraph, curSpeaker) => {
    if (!paragraph.startsWith('Speaker')) return curSpeaker;

    const loc = paragraph.indexOf(':');
    if (loc === -1) return curSpeaker;
    
    const test = paragraph.substring(8, loc);
    if (isNaN(test)) return curSpeaker;

    return Number(test);
    
}

async function getCleanedTranscript (chunk, specialInstructions = '') {
    const prompt = `"""The transcript below was generated by ai in the following format: Speaker Name: Utterance. The Speaker Names preceded by a colon are accurate. Correct the transcript utterances as follows. Correct the sentences where people stutter to make them read smoothly. Rewrite numbers and numeric references in human friendly format. The company producing this transcript is PYMNTS and its website is PYMNTS.com.  ${specialInstructions} Be sure to return the entire corrected transcript including all speaker names and all their corrected utterances.\n\nTranscript:\n${chunk.paragraphs.join("\n")}"""\n`;

    let response = await ai.getTurboResponse(prompt, 0.4);
    
    chunk.cleanedTranscript = response.status === 'success' ? response.content : false;
}

async function getTheFacts (chunk) {
    const prompt = `"""Make a list of every fact, idea, notion, and concept that can be extracted from the following transcript:\n\nTranscript:\n${chunk.cleanedTranscript}\n"""\n`;

    let response = await ai.getTurboResponse(prompt, 0.4);
    
    chunk.facts = response.status === 'success' ? response.content : false;
}

async function createInitialParagraphs (chunk) {
    const numParagraphs = Math.ceil(chunk.size / 350);

    console.log('numParagraphs', numParagraphs);

    const prompt = `"""Write a dynamic and engaging first ${numParagraphs > 1 ? `${numParagraphs} paragraphs` : "paragraph"} of a news article using the Facts, Ideas, Notions, and Concepts provided below:\n\n${chunk.facts}\n"""\n`;

    let response = await ai.getTurboResponse(prompt, 0.3);
    
    chunk.initialArticle = response.status === 'success' ? response.content : false;
}

async function insertQuotes (chunk) {
    const numQuotes = Math.ceil(chunk.size / 450);
    const addition = numQuotes > 1 ? `${numQuotes} relevant quotes` : '1 relevant quote';

    const prompt = `"""Below is the beginning of a News Article and a related Transcript. Expand this news article by incorporating at least ${addition} from the provided Transcript.
    News Article:
    ${chunk.initialArticle}
    Transcript:
    ${chunk.cleanedTranscript}"""\n`

    let response = await ai.getTurboResponse(prompt, 0.4);
    
    chunk.insertedQuotes = response.status === 'success' ? response.content : false;
}

function rewriteInAnEngagingStyle (article) {
    return new Promise(async (resolve, reject) => {
        const prompt = `"""In the style of a eloquent author, rewrite the following News Article in a dynamic and conversational manner. Ensure your response preserves all the quotes in the news article. The response must be at least 800 words.
        News Article:
        ${article.initialArticle}\n"""\n`;
        
        let response = await ai.getTurboResponse(prompt, 0.4);
        
        article.engagingArticle = response.status === 'success' ? response.content : false;
        resolve('ok');
    })
}

function getTagsAndTitles (article, numTitles = 10) {
    return new Promise(async (resolve, reject) => {
        const prompt = `"""Give ${numTitles} interesting titles for the provided News Article below.
    Also generate a list of tags that include the important words and phrases in the response. 
    The list of tags must also include the names of all people, products, services, places, companies, and organizations mentioned in the response.
    Also generate a conclusion for the news article.
    The return format must be stringified JSON in the following format: {
        "titles": array of titles goes here
        "tags": array of tags go here
        "conclusion": conclusion goes here
    }
    News Article:
    ${article.initialArticle}\n"""\n`;

        let response = await ai.getTurboResponse(prompt, 0.4);
            
        article.titleTags = response.status === 'success' ? response.content : false;
        resolve('ok')
    })
}

function transformChunk (chunk, instructions) {
    return new Promise(async (resolve, reject) => {
        await getCleanedTranscript(chunk, instructions);
        if (chunk.cleanedTranscript === false) return reject ('Could not clean chunk.');
            
        await getTheFacts(chunk);
        if (chunk.facts === false) return reject ('Could not extract facts');

        await createInitialParagraphs(chunk);
        if (chunk.initialArticle === false) return reject ('Could not create initial article from facts.');
            
        await insertQuotes(chunk);
        if (chunk.insertedQuotes === false) return reject ('Could not insert quotes into the initial article.');
           
        resolve('ok');
    })
}

async function createDynamicArticle (transcript, speakers, entities, socket) {

    console.log(transcript, speakers);
    
    /*
     * Assign a speaker to every paragraph
     */
    let curSpeaker = -1;
    let paragraphs = transcript.split("\n");
    for (let i = 0; i < paragraphs.length; ++i) {
        const paragraph = paragraphs[i];
        if (!paragraph) {
            continue;
        }
        curSpeaker = getCurrentSpeaker(paragraph, curSpeaker);
        if (curSpeaker >= speakers.length) curSpeaker = -1;
        const speakerName = curSpeaker === -1 ? 'Unknown' : speakers[curSpeaker];
        const loc = paragraph.indexOf(':');
        if (!paragraph.startsWith('Speaker')) {
            paragraphs[i] = `${speakerName}: ${paragraph}`;
        }
        else {
            paragraphs[i] = `${speakerName}${paragraph.substring(loc)}`;
        }
    }

    /*
     * Calculate the number of words
     */
    let numWords = 0;
    for (let i = 0; i < paragraphs.length; ++i) {
        let words = paragraphs[i].split(" ");
        numWords += words.length ? words.length : 1;
    }
    console.log('numWords', numWords);

    /*
     * Split transcript paragraphs into chunks needed
     */
    const numChunks = Math.ceil(numWords / 1200);
    const chunkSize = numWords / numChunks;

    console.log('numChunks', numChunks, chunkSize);
    
    let chunks = [];
    let curChunk = 0, curSize = 0;
    chunks[curChunk] = {paragraphs: []}
    for (let i = 0; i < paragraphs.length; ++i) {
        let words = paragraphs[i].split(" ");
        numWords = words.length ? words.length : 1;
        if (curSize + numWords > chunkSize && curChunk < numChunks - 1) {
            chunks[curChunk].size = curSize;
            ++curChunk;
            chunks[curChunk] = {paragraphs: []};
            curSize = 0;
        }
        chunks[curChunk].paragraphs.push(paragraphs[i]);
        curSize += numWords;
    }
    chunks[curChunk].size = curSize;

    /*
     * Process each chunk independently
     */
    paragraphs = null;
    transcript = null;
    speakers = null;

    let transformations = [];
    for (let i = 0; i < chunks.length; ++i) {
       let task = transformChunk(chunks[i], entities);
       transformations.push(task);
    }

    console.clear();
    console.log('waiting for tasks', transformations);
    await Promise.all(transformations);

    console.log('chunks', chunks);
    //socket.emit('message', 'chunks done. debug ready.');

    let transcriptArr = [];
    for (let i = 0; i < chunks.length; ++i) {
        transcriptArr.push(chunks[i].cleanedTranscript);
    }

    transcript = transcriptArr.join("\n");
    socket.emit('finalTranscript', transcript);

    const finalTranscriptName = uuidv4() + '.txt';
    const link = await s3.uploadTxt(transcript, 'whisper', finalTranscriptName);
    console.log('link', link);
    
    return;
    
    let article = {};
    const initialArticleArray = [];
    for (let i = 0; i < chunks.length; ++i) initialArticleArray.push(chunks[i].insertedQuotes);    
    article.initialArticle = initialArticleArray.join("\n");
    chunks = null;

    transformations = [];

    console.log('INITIAL ARTICLE', article.initialArticle);
    
    let articleWords = article.initialArticle.split(" ").length;

    console.log('articleWords', articleWords);

    let finalArticle = rewriteInAnEngagingStyle(article);
    let titleTags = getTagsAndTitles(article);

    await Promise.all([finalArticle, titleTags]);

    console.log('FINAL ARTICLE:', article);

    return article;

}

const handleSpeakers = async (socket, info) => {
    const { rawTranscript, speakerList, entities } = info;
    console.log('handleSpeakers', rawTranscript);

    socket.emit('gotSpeakers', 'got them');

    socket.emit ('message', 'Cleaning the transcript now. This can take several minutes.');
    
    const article = await createDynamicArticle(rawTranscript, speakerList, entities, socket);

    socket.emit('done', 'articleComplete');

    socket.emit('article', article);
}


//createDynamicArticle(testTranscript, testSpeakers);
const socketConnection = socket => {

    console.log('connection', socket.id);
    sockets[socket.id] = socket;

    socket.on('url', (url) => handleUrl(socket, url));
    socket.on('speakers', (speakerList) => handleSpeakers(socket, speakerList));
}

const uploadMp4 = async (req, res) => {
    const { s } = req.query;

    if (!s) return res.status(400).json('bad request 1');

    if (!sockets[s]) return res.status(400).json('bad request 2');

    const socket = sockets[s];

    var form = new formidable.IncomingForm({maxFileSize: 2000 * 1024 * 1024});

    socket.emit('message', 'Uploading the file. This can take several minutes.');

    form.parse(req, async function (err, fields, data) {
        //console.log('form data', data);
        if (err) {
            console.error(err);
            return res.status(500).json('form error');
        }
        let fileName = data['File[]'].filepath;
        let originalFileName = data['File[]'].originalFilename;
        let loc = originalFileName.lastIndexOf('.');
        let extension = originalFileName.substring(loc+1).toLowerCase();
        console.log('fileName', originalFileName, extension, data);
        fs.renameSync(fileName, fileName + '.' + extension);
        fileName += '.' + extension;
        switch (extension) {
            case 'mp4':
                processMp4File(fileName, socket);
                return res.status(200).json('ok');    
            case 'm4a':
            case 'mp3':
            case 'flac':
            case 'wav':
                processAudioFile(fileName, socket);
                return res.status(200).json('ok');
                
        }
        /*
         * original mp4 code
         */
        if (extension === 'mp4') {
            fs.renameSync(fileName, fileName + '.mp4');

            fileName += '.mp4';
    
            processMp4File(fileName, socket)
            
            return res.status(200).json('ok');    
        }

        if (extension )
        
        return res.status(200).json('ok');

        
        
    });
}

app.get('/', (req, res) => {
    res.send('Hello, World!');
});

app.post('/uploadMp4', (req, res) => uploadMp4(req, res));

const httpsServer = https.createServer({
    key: fs.readFileSync(privateKeyPath),
    cert: fs.readFileSync(fullchainPath),
  }, app);

const io = require('socket.io')(httpsServer, {
    cors: {
      origin: "https://whisper.pymnts.com",
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
