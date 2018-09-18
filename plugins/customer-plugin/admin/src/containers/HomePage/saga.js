// import { LOCATION_CHANGE } from 'react-router-redux';
// import { takeLatest, put, fork, take, cancel } from 'redux-saga/effects';
import request from 'utils/request';

export function* fetchData() {
    try {
      const opts = { method: 'GET' };
  
      // To make a POST request { method: 'POST', body: {Object} }
  
      const endPoint = yield select(makeSelectContentTypeName());
      const requestUrl = `my-plugin/**/${endPoint}`;
  
      // Fetching data with our request helper
      const data = yield call(request, requestUrl, opts);
      yield put(dataFetchSucceeded(data));
    } catch(error) {
      yield put(dataFetchError(error.message));
    }
  }

  export function* postData() {
    try {
      const body = { data: 'someData' };
      const opts = { method: 'POST', body };
      const requestUrl = `**yourUrl**`;
  
      const response = yield call(request, requestUrl, opts, true);
  
      if (response.ok) {
        yield put(submitSucceeded());      
      } else {
        yield put(submitError('An error occurred'));
      }
    } catch(error) {
      yield put(submitError(error.message));
    }
  }

// Individual exports for testing
export function* defaultSaga() {
}

// All sagas to be loaded
export default defaultSaga;
