import React, { Component } from 'react';
import ReactTable from 'react-table';
// import { render } from "react-dom";
// import { makeData, Logo, Tips } from "./Utils.js";
import {queryAPI} from '../utilities/commonApi.js';
// import "react-table/react-table.css";

class Customer extends Component{
constructor(){
  super();
  this.state = {
    data: []
  }
}

componentWillMount(){
  queryAPI('http://localhost:1337/customers', 'helloworld')
  queryAPI('http://localhost:2000/customers', 'helloworld')
  .then(results => {
    console.log("res", results);
    this.setState({data: results.data});
    
  });

}

  // const { data, pages } = props.data;
  render(){
    return (
      <div id="customers">
        <ReactTable
          columns={[
            {
              columns: [
              {
                  Header: "ID",
                  id: "id",
                  accessor: data => data.id
              },
              {
                  Header: "NAME",
                  accessor: "name",
              },
              {
                  Header: "SITE NAME",
                  accessor: "site_name"
              },
              {
                  Header: "URL",
                  accessor: "site_url"
              },
              {
                  Header: "Active",
                  accessor: "active",
                Cell: row => (
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      backgroundColor: '#dadada',
                      borderRadius: '2px'
                    }}
                  >
                    <div
                      style={{
                width: `${row.value}%`,
                        height: '100%',
                        backgroundColor: row.value > 66 ? '#85cc00'
                        : row.value > 33 ? '#ffbf00'
                        : '#ff2e00',
                        borderRadius: '2px',
                        transition: 'all .2s ease-out'
                      }}
                    />
                  </div>)
              }]
            }]}
          data={this.state.data}
          // pages = {this.state.data}
          defaultPageSize={5}
        className="-striped -highlight"/>
        <br />
        {/* <Tips /> */}
      </div>
    );
  }

}

export default Customer;
