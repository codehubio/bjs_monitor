import { config } from "../../config";

const queries =[{
  "name": "Total SubmitOrder calls",
  "query": "eapi_method: SubmitOrder AND (NOT eapi_direction: Started)",
  "view": config.graylogSubmitOrderSearchView
}]
export const GROUP_BY_COLUMN = 'eapi_err_desc';
export default queries;