import { config } from "../../config";

const queries =[{
  "name": "All EAPI calls",
  "query": "NOT eapi_direction:Started",
  "view": config.graylogDailyEapiSearchView
}, {
  "name": "Total EAPI cronjob", 
  "query":"eapi_ip:undefined",
  "view": config.graylogDailyEapiSearchView
}, {
  "name": "Failed EAPI calls by http",
  "query":`eapi_http_status:>500 OR ((NOT eapi_direction:Ended) AND (NOT eapi_direction:Started) AND (NOT "expectedAction") AND (NOT "maps.googleapis.com") AND (NOT "apple-pay-gateway.apple.com") AND (NOT "aem.prod.bjsrestaurants.com"))`,
  "view": config.graylogDailyEapiSearchView
}, {
  "name": "EAPI calls by duration > 10 seconds",
  "query":"eapi_duration:>10000",
  "view": config.graylogDailyEapiSearchView
}]

export default queries;