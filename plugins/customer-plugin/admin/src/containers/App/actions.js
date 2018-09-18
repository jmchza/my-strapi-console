/*
 *
 * App actions
 *
 */
import {
    DATA_FETCH,
    DATA_FETCH_ERROR,
    DATA_FETCH_SUCCEEDED,
  } from './constants';
  
  export function dataFetch(params) {
    return {
      type: DATA_FETCH,
      params,
    };
  }
  
  export function dataFetchError(errorMessage) {
    return {
      type: DATA_FETCH_ERROR,
      errorMessage,
    };
  }
  
  export function dataFetchSucceeded(data) {
    return {
      type: DATA_FETCH_SUCCEEDED,
      data,
    };
  }