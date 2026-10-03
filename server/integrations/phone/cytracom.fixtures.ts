/**
 * Example response of GET https://api.cytracom.net/v1.0/data/users, copied
 * from Cytracom's "API - Data Services" doc:
 * https://help.cytracom.com/hc/en-us/articles/360021912211-API-Data-Services
 */
export const CYTRACOM_DATA_USERS_EXAMPLE = {
  data: {
    users: [
      { name: "Bob Dylan", extension_number: "200", email: "bob@customeraccount.com" },
      { name: "Keri Parker", extension_number: "201", email: "kerip@customeraccount.com" },
      { name: "Jane Trewin", extension_number: "205", email: null },
      { name: "Miranda Green", extension_number: "202", email: "mgreen@customeraccount.com" },
    ],
  },
  code: 200,
};
