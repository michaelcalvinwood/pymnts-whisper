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

exports.getDivinciResponse = async (prompt, socket = null) => {
    console.log("DAVINCI");

    prompt = '"""' + prompt.replaceAll("\n\n", "\n") + '"""' + "\n";

    console.log('prompt', prompt);

    const request = {
        url: 'https://api.openai.com/v1/completions',
        method: 'post',
        headers: {
            'Authorization': `Bearer ${process.env.PYMNTS_OPENAI_KEY}`,
        },
        data: {
            model: "text-davinci-003",
            prompt,
            max_tokens: 1500,
            temperature: .7
        }
    }

    let response;

    try {
        response = await axios(request);
        console.log(response.data);
    } catch (err) {
        console.log(JSON.stringify(err, null, 4));
        //console.error(err);
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

async function turboChatCompletion (prompt, temperature = 0, service = 'You are a helpful, accurate assistant.') {
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
            temperature,
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

const getTurboResponse = async (prompt, socket = null, temperature = 0, service = 'You are a helpful, accurate assistant.') => {
    //console.log('TURBO', prompt);

    if (!prompt.endsWith("\n")) prompt += "\n";

    let result;
    let success = false;
    let count = 0;
    let seconds = 30;
    let maxCount = 5;
    while (!success) {
        try {
            result = await turboChatCompletion(prompt, temperature, service);
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


exports.cleanTranscriptChunk = async (chunk, model = 'turbo', socket = null) => {
    //chunk = chunk.replaceAll("\n", "") + "\n";
    
    let prompt = process.env.CLEANUP_TRANSCRIPT_PROMPT + chunk;
    
    //console.log('prompt', prompt);

    //prompt = 'Say hello world';
    
    return model === 'davinci' ? this.getDivinciResponse(prompt, socket) : getTurboResponse(prompt, socket);    
}

exports.startArticle = async (initialTranscript, model = 'turbo', socket = null) => {
    let prompt = `"""I want you to create an warm, conversational blog post based on the information revealed in the following Transcript.
    Make your blog post four paragraphs.  
    Transcript:
    ${initialTranscript}"""\n`;

    return model === 'davinci' ? this.getDivinciResponse(prompt, socket) : getTurboResponse(prompt, socket, 0.5, 'You are a witty writer — creating fascinating narratives from factual information.');   
}

exports.continueArticle = async transcript => {
    console.log("ai.continueArticle");
}

exports.endArticle = async (transcript, article, model = 'turbo', socket = null ) => {
    let prompt = `"""Below is an exerpt of a Transcript as well as the beginning of an article based on a previous portion of the transcript. You will provide the final four paragraphs of this article based on this present transcript excerpt. Do not create a blow by blow description of the transcript. Instead, the style of the paragraphs must be conversational, dynamic, and engaging — telling a story based on the information in the article. The response should be approximately 500 words. The response should not repeat the prior article but solely provide the next part of the article. End the response with a conlusion or     summary of the entire article.\n\nTranscript:\n${transcript}\n\nArticle:\n${article}"""\n`;

    return model === 'davinci' ? await this.getDivinciResponse(prompt, socket) : await getTurboResponse(prompt, socket);

    //console.log('result', result);
}

exports.fullArticle = async transcript => {
    console.log("ai.fullArticle");
}


