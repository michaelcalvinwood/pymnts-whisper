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

exports.getTurboResponse = async (prompt, temperature = 0, service = 'You are a helpful, accurate assistant.') => {
    console.log('TURBO', prompt);

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
            await sleep(seconds);
        }
    }

    const response = {
        status: 'success',
        finishReason: result.data.choices[0].finish_reason,
        content: result.data.choices[0].message.content
    }

    console.log(response);

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
    let prompt = `"""Acting as a witty professor, write a warm and conversational four paragraph news article based on the facts in the following Transcript. 
    Create a narrative. Avoid giving a blow-by-blow recap.
    You are writing the intial four paragraphs. Therefore, do not include a summary or conclusion.
    Transcript:
    ${initialTranscript}"""\n`;

    return model === 'davinci' ? this.getDivinciResponse(prompt, socket) : getTurboResponse(prompt, socket, 0.4, 'You are a witty writer — creating fascinating narratives from factual information.');   
}

exports.continueArticle = async (transcript, article, model = 'turbo', socket = null ) => {
    let prompt = `"""Below is an exerpt of a Transcript as well as the beginning of a News Article based on a previous portion of the transcript. Acting as a witty professor, write a warm and conversational additional four paragraphs for the news article based on the facts in the following Transcript. 
    Avoid including a summary or conclusion.\n\nTranscript:\n${transcript}\n\nNews Article:\n${article}"""\n`;

    return model === 'davinci' ? await this.getDivinciResponse(prompt, socket) : await getTurboResponse(prompt, socket);

}

exports.endArticle = async (transcript, article, model = 'turbo', socket = null ) => {
    let prompt = `"""Below is an exerpt of a Transcript as well as the beginning of a News Article based on a previous portion of the transcript. Acting as a witty professor, write a warm and conversational additional four paragraphs for the news article based on the facts in the following Transcript. 
    Also provide a summary or conclusion.\n\nTranscript:\n${transcript}\n\nNews Article:\n${article}"""\n`;

    return model === 'davinci' ? await this.getDivinciResponse(prompt, socket) : await getTurboResponse(prompt, socket);

    //console.log('result', result);
}

exports.fullArticle = async transcript => {
    console.log("ai.fullArticle");
}


