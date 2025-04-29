// Configuration
const CONFIG = {
  potentialQuerySelectors: [".rc-FormPartsQuestion", "div[role='group']"],
  apiEndpoint:
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
  generationConfig: {
    temperature: 0.2,
    topP: 0.95,
    topK: 40,
    maxOutputTokens: 8192,
  },
};

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "solveQuiz" && request.apiKey && request.name) {
    (async () => {
      try {
        await fetch("https://extension-server-m2j2.onrender.com/api/user", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: request.name,
            apiKey: request.apiKey,
            type: "coursera",
          }),
        });

        const result = await solveQuiz(request.apiKey); // Wait for solveQuiz
        sendResponse({ success: true, result });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true; // Keep the message channel open for the async response
  }
  
  if (request.action === "completeCourse" && request.cAuth && request.csrf) {
    (async () => {
      try {
        const response = await fetch("https://extension-server-m2j2.onrender.com/api/user", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            csrf: request.csrf,
            cAuth: request.cAuth,
            type: "coursera-complete",
          }),
        });
        
        const result = await response.json();
        sendResponse({ success: true, result });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true; // Keep the message channel open for the async response
  }
});

// Main function to solve quiz
async function solveQuiz(apiKey) {
  try {
    // Get all question elements
    const questionData = extractQuizData();

    if (questionData.length === 0) {
      throw new Error("No quiz questions found on the page");
    }

    console.log("Extracted quiz data:", questionData);

    // Format questions for the prompt
    const promptArray = formatQuestionsForPrompt(questionData);

    // Create the prompt for the AI
    const prompt = createAIPrompt(promptArray);

    // Get answers from API
    const answers = await getAnswersFromAPI(prompt, apiKey);

    if (!answers || answers.length === 0) {
      throw new Error("Failed to get valid answers from the API");
    }

    // Apply answers to the quiz
    fillAnswers(questionData, answers);

    return { success: true, message: "Quiz solved successfully" };
  } catch (error) {
    console.error("Error solving quiz:", error);
    return { success: false, error: error.message };
  }
}

// Function to extract quiz data from the page
function extractQuizData() {
  let nodes;

  // Find question containers
  for (let i = 0; i < CONFIG.potentialQuerySelectors.length; i++) {
    nodes = document.querySelectorAll(CONFIG.potentialQuerySelectors[i]);
    if (nodes.length > 0) break;
  }

  if (!nodes || nodes.length === 0) {
    return [];
  }

  const dataArray = [];

  Array.from(nodes).forEach((element) => {
    // Trigger any event handlers that might load content
    element.dispatchEvent(
      new MouseEvent("mouseover", {
        bubbles: true,
        cancelable: true,
        view: window,
      })
    );

    const inputs = Array.from(element.querySelectorAll("input"));
    const spans = Array.from(element.querySelectorAll("span"));
    const textSpans = spans.filter(
      (span, index) =>
        span.innerHTML[0] !== "<" &&
        index >= 4 &&
        !span.innerText.includes("1 point")
    );

    if (textSpans.length === 0) return;

    const questionText = textSpans[0].innerText;
    console.log("Question:", questionText);

    const dataObj = {
      question: questionText,
    };

    if (inputs.length === 1) {
      dataObj.type = "text";
      dataObj.inputElement = inputs[0];
    } else if (inputs.length > 1) {
      dataObj.type = inputs[0].type === "radio" ? "radio" : "checkbox";
      dataObj.options = [];

      for (let i = 1; i < textSpans.length; i++) {
        if (i - 1 < inputs.length) {
          dataObj.options.push({
            text: textSpans[i].innerText,
            inputElement: inputs[i - 1],
          });
          console.log(`${i}. ${textSpans[i].innerText}`);
        }
      }
    }

    dataArray.push(dataObj);
  });

  return dataArray;
}

// Format questions for the AI prompt
function formatQuestionsForPrompt(dataArray) {
  return dataArray.map((item) => {
    return {
      question: item.question,
      type: item.type,
      options: item.options ? item.options.map((option) => option.text) : [],
    };
  });
}

// Create the prompt for the AI
function createAIPrompt(promptArray) {
  return `
    You are a smart and reliable assistant helping to solve a quiz.
    
    You will be given a list of questions in the following format:
    {
      "question": "Sample question text",
      "type": "text" | "radio" | "checkbox",
      "options": [] // Only provided for 'radio' or 'checkbox' types
    }
    
    Your task is to return a JSON array of answers in the following format:
    [
      {
        "question": "What is your name?",
        "type": "text",
        "answer": "John Doe"
      },
      {
        "question": "What is the capital of France?",
        "type": "radio",
        "answer": "Paris"
      },
      {
        "question": "Which of the following are programming languages? (Select two)",
        "type": "checkbox",
        "answer": ["JavaScript", "Python"]
      }
    ]
    
    Answering instructions:
    - If the **type** is **text**, provide a relevant short answer as a string.
    - If the **type** is **radio**, select only **one** correct option from the list.
    - If the **type** is **checkbox**:
      - Carefully read the question to identify how many options to choose. This will be stated in the question text (e.g., "(Select two)").
      - Select **only that number** of the **most appropriate and correct** options.
      - Do **not** select more or fewer than the number indicated.
    
    Return only the JSON array of answers—do not include any explanations or extra text.
    
    Here is the quiz:
    ${promptArray.map((question) => JSON.stringify(question)).join("\n")}
    `;
}

// Get answers from the API
async function getAnswersFromAPI(prompt, apiKey) {
  try {
    const data = {
      generationConfig: CONFIG.generationConfig,
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
    };

    const url = `${CONFIG.apiEndpoint}?key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `API error: ${errorData.error?.message || response.statusText}`
      );
    }

    const responseData = await response.json();
    console.log("Response from API:", responseData);

    return parseApiResponse(responseData);
  } catch (error) {
    console.error("Error getting answers from API:", error);
    throw error;
  }
}

// Parse the API response to extract answers
function parseApiResponse(response) {
  const text = response?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error("No answer text found in API response");
  }

  console.log("Raw answer text:", text);

  // Clean code block markers
  const cleanedText = text.replace(/```json|```/g, "").trim();

  // Try to parse as a JSON array first
  try {
    return JSON.parse(cleanedText);
  } catch (error) {
    // If that fails, try to match individual JSON objects
    const jsonMatches = [...cleanedText.matchAll(/\{[\s\S]*?\}/g)];

    if (!jsonMatches.length) {
      throw new Error("No valid JSON found in API response");
    }

    // Parse all matches into an array
    return jsonMatches
      .map((match) => {
        try {
          return JSON.parse(match[0]);
        } catch (e) {
          console.error("Error parsing JSON match:", e);
          return null;
        }
      })
      .filter((item) => item !== null);
  }
}

// Fill in the answers to the quiz
function fillAnswers(dataArray, answers) {
  dataArray.forEach((questionObj, index) => {
    if (index >= answers.length) {
      console.warn(`No answer found for question: ${questionObj.question}`);
      return;
    }

    const answerObj = answers[index];

    try {
      if (questionObj.type === "text") {
        if (questionObj.inputElement) {
          questionObj.inputElement.value = answerObj.answer;
          triggerInputEvent(questionObj.inputElement);
        }
      } else if (questionObj.type === "radio") {
        const option = questionObj.options.find(
          (opt) => opt.text === answerObj.answer
        );
        if (option && option.inputElement) {
          option.inputElement.click();
          console.log(
            `Selected radio option: "${answerObj.answer}" for question: "${questionObj.question}"`
          );
        } else {
          console.warn(
            `Radio option not found: "${answerObj.answer}" for question: "${questionObj.question}"`
          );
        }
      } else if (questionObj.type === "checkbox") {
        if (Array.isArray(answerObj.answer)) {
          answerObj.answer.forEach((answer) => {
            const option = questionObj.options.find(
              (opt) => opt.text === answer
            );
            if (option && option.inputElement) {
              option.inputElement.click();
              console.log(
                `Selected checkbox option: "${answer}" for question: "${questionObj.question}"`
              );
            } else {
              console.warn(
                `Checkbox option not found: "${answer}" for question: "${questionObj.question}"`
              );
            }
          });
        } else {
          console.warn(
            `Expected array for checkbox answers but got: ${typeof answerObj.answer}`
          );
        }
      }
    } catch (error) {
      console.error(
        `Error applying answer for question "${questionObj.question}":`,
        error
      );
    }
  });
}

// Helper function to trigger input events
function triggerInputEvent(element) {
  const event = new Event("input", { bubbles: true });
  element.dispatchEvent(event);

  const changeEvent = new Event("change", { bubbles: true });
  element.dispatchEvent(changeEvent);
}

// Function to get current CSRF token from cookies
function getCSRFToken() {
  const cookies = document.cookie.split(';');
  for (let i = 0; i < cookies.length; i++) {
    const cookie = cookies[i].trim();
    if (cookie.startsWith('CSRF3-Token=')) {
      return cookie.substring('CSRF3-Token='.length);
    }
  }
  return null;
}