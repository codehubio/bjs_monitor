import { config } from "../../config";

const queries =[{
  "name": "Open Check",
  "query": "userflow_action:ON_LOAD_OPEN_CHECK_MP",
  "view": config.graylogOpenCheckSearchView
}]

export default queries;
