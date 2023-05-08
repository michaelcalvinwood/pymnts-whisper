

const media = require('./utils/media');
const ai = require('./utils/ai');
const deepgram = require('./utils/deepgram');



async function doStuff() {
    deepgram.transcribeRecording('./media/test.mp3', './media/yoyo.txt');
}

doStuff();