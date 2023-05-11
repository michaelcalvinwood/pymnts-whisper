require('dotenv').config();

const axios = require('axios');
const fs = require('fs');
const fsPromises = require('fs').promises;

const { Configuration, OpenAIApi } = require("openai");



const configuration = new Configuration({
    apiKey: process.env.PYMNTS_OPENAI_KEY,
  });
const openai = new OpenAIApi(configuration);
const sleep = seconds => new Promise(r => setTimeout(r, seconds * 1000));

exports.getDivinciResponse = async (prompt) => {
    const request = {
        url: 'https://api.openai.com/v1/completions',
        method: 'post',
        headers: {
            'Authorization': `Bearer ${process.env.PYMNTS_OPENAI_KEY}`,
        },
        data: {
            model: "text-davinci-003",
            prompt,
            max_tokens: 4000,
            temperature: 0
        }
    }

    let response;

    try {
        response = await axios(request);
        console.log(response.data);
    } catch (err) {
        console.error(err);
        return {
            status: 'error',
            number: err.response.status,
            message: err.response,
        }
    }

    return {
        status: 'success',
        finishReason: response.data.choices[0].finish_reason,
        content: response.data.choices[0].text
    }
}

async function turboChatCompletion (prompt, service = 'You are a helpful, accurate assistant.') {
    /* 
     * NO NEED TO SPECIFY MAX TOKENS
     * role: assistant, system, user
     */


    const request = {
        url: 'https://api.openai.com/v1/chat/completions',
        method: 'post',
        headers: {
            'Authorization': `Bearer ${process.env.PYMNTS_OPENAI_KEY}`,
        },
        data: {
            model: "gpt-3.5-turbo",
            temperature: 0,
            messages:[
                {
                    role: 'system',
                    content: service,

                },
                {
                    role: 'user',
                    content: prompt
                }
            ]
        }
    }

    return axios(request);
}


exports.transcribeAudio = async (inputFileName, outputFileName) => {
    const transcript = await openai.createTranscription(
      fs.createReadStream(inputFileName),
      "whisper-1"
    );

    await fsPromises.writeFile(outputFileName, transcript.data.text);
    return;
}

const getTurboResponse = async (prompt, socket = null) => {
    if (!prompt.endsWith("\n")) prompt += "\n";

    let result;
    let success = false;
    let count = 0;
    let seconds = 30;
    let maxCount = 5;
    while (!success) {
        try {
            result = await turboChatCompletion(prompt);
            success = true;
        } catch (err) {
            console.error("axios err.data", err.response.status, err.response);
            ++count;
            if (count >= maxCount) {
                return {
                    status: 'error',
                    number: err.response.status,
                    message: err.response,
                }
            }
            seconds *= 2;
            if (socket) socket.emit('error', `ChatGPT servers overloaded. Retrying in ${seconds} seconds`);
            await sleep(seconds);
        }
    }

    const response = {
        status: 'success',
        finishReason: result.data.choices[0].finish_reason,
        content: result.data.choices[0].message.content
    }

    //console.log(response);

    return response;
}

exports.cleanTranscriptChunk = async (chunk, socket = null) => {
    let prompt = process.env.CLEANUP_TRANSCRIPT_PROMPT + chunk;
    return getTurboResponse(prompt, socket);    
}

exports.startArticle = async initialTranscript => {
    let prompt = `Below is an exerpt of a transcript. You will create the beginning of an article based on this transcript. Your response must be in HTML format. The response must engaging while using the information in the article. Do not create a blow by blow description of the transcript. The response should be approximately 500 words. The response must include two quotes from the transcript. \n\nTranscript:\n${initialTranscript}`;

    return getTurboResponse(prompt);    
}

exports.continueArticle = async transcript => {
    console.log("ai.continueArticle");
}

exports.endArticle = async (transcript, article) => {
    let prompt = `Below is an exerpt of a Transcript as well as the beginning of an HTML Article based on a previous portion of the transcript. You will add HTML content to the article based on this present transcript excerpt. The response must engaging while using the information in the article. Do not create a blow by blow description of the transcript. The response should be approximately 500 words. The response must include two quotes from the transcript. The response should not repeat the prior article but solely provide the next part of the article. The next part of the article must be in HTML format.\n\nTranscript:\n${transcript}\n\nHTML Article:\n${article}\n`;

    let result = getTurboResponse(prompt);

    console.log('result', result);
    
    if (result.status === 'error') return result;

    let test = result.content.indexOf('<p>');

    if (test === -1) {
        let paragraphs = result.content.split("\n");
        for (let i = 0; i < paragraphs.length; ++i) {
            let paragraph = paragraphs[i];
            if (!paragraph.length) continue;
            paragraph = '<p>' + paragraph + '</p>';
        }
        result.content = paragraphs.join("\n");
    }

    return result;
}

exports.fullArticle = async transcript => {
    console.log("ai.fullArticle");
}


