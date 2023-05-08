

const media = require('./utils/media');

(async () => {
    const result = await media.download('https://content.jwplatform.com/videos/L0jBTtHF-96F1EhHl.mp4', 'media/test.mp4')

    console.log('result', result);
})()