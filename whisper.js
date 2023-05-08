

const media = require('./utils/media');
const ai = require('./utils/ai');
const deepgram = require('./utils/deepgram');
const info = require('./media/yoyo.json');

async function doStuff() {
    //deepgram.transcribeRecording('./media/test.mp3', './media/yoyo.json');

    deepgram.generateSpeakerBasedTranscript(info);
}

doStuff();