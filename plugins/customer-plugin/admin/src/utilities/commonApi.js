// import axios from 'axios';
// import {unwrapError} from "./errors";

// export const doGet = async (url) => {
//     try {
//         return await axios.get(url);
//     }catch (error) {
//         throw unwrapError(error.response);
//     }
// };
//
// export const doPost = async (url, payload) => {
//     try {
//         return await axios.post(url, payload);
//     }catch (error) {
//         throw unwrapError(error.response);
//     }
// };
//
// export const doPut = async (url, payload) => {
//     try {
//         return await axios.put(url, payload);
//     }catch (error) {
//         throw unwrapError(error.response);
//     }
// };
//
// export const doDelete = async (url) => {
//     try {
//         return await axios.delete(url);
//     }catch (error) {
//         throw unwrapError(error.response);
//     }
// };

export const queryAPI = function(query, cb) {
  return fetch(query, {
    accept: "application/json"
  })
    .then(checkStatus)
    .then(parseJSON);
    // .then(cb);
}

function checkStatus(response) {
  if (response.status >= 200 && response.status < 300) {
    return response;
  }
  const error = new Error(`HTTP Error ${response.statusText}`);
  error.status = response.statusText;
  error.response = response;
  console.log(error); // eslint-disable-line no-console
  throw error;
}

function parseJSON(response) {
  return response.json();
}

// const queryAPI = { queryAPI };
// export default queryAPI;
