const axios = require("axios");

const login = async (req, res) => {
  const {
    SF_LOGIN_URL,
    SF_CLIENT_ID,
    SF_CLIENT_SECRET,
    SF_USERNAME,
    SF_PASSWORD,
  } = process.env;

  // Prepare the login request data
  const loginData = new URLSearchParams({
    grant_type: "password",
    client_id: SF_CLIENT_ID,
    client_secret: SF_CLIENT_SECRET,
    username: SF_USERNAME,
    password: SF_PASSWORD,
  });

  try {
    // Make the request to Salesforce
    const response = await axios.post(
      `${SF_LOGIN_URL}/services/oauth2/token`,
      loginData.toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );
    // console.log(response);

    // Return the access token and instance URL
    res.json({
      accessToken: response.data.access_token,
      instanceUrl: response.data.instance_url,
      tokenType: response.data.token_type,
      signature: response.data.signature,
    });
  } catch (error) {
    // Handle errors
    console.error("Salesforce Login Error:", error.message);
    res.status(500).json({ error: "Failed to log in to Salesforce" });
  }
};

const accountDetails = async (req, res) => {
  const access_token = process.env.AccessToken;
  const instance_url = process.env.InstanceUrl;

  try {
    const queries = [
      "SELECT Id, Name, Active_Closed__c, Manufacturers_Names__c, Phone FROM Account WHERE Active_Closed__c IN ('Active Account') ",
      "SELECT Name, AccountId__c, Active_Closed__c, ManufacturerId__c, ManufacturerName__c, Sales_Rep__c FROM Account_Manufacturer__c ",
    ];

    const [response1, response2] = await Promise.all(
      queries.map((query) =>
        axios.get(
          `${instance_url}/services/data/v57.0/query?q=${encodeURIComponent(
            query
          )}`,
          {
            headers: {
              Authorization: `Bearer ${access_token}`,
              "Content-Type": "application/json",
            },
          }
        )
      )
    );

    const mappedAccounts = response1.data.records.map((account) => ({
      accountId: account.Id,
      accountName: account.Name,
      manufacturersNames: account.Manufacturers_Names__c
        ? account.Manufacturers_Names__c.split(";").map((name) => name.trim())
        : [],
    }));

    // console.log(mappedAccounts)

    const mappedManufacturers = response2.data.records.map((manufacturer) => ({
      manufacturerId: manufacturer.AccountId__c,
      manufacturerName: manufacturer.ManufacturerName__c,
      manufacturerSalesRep: manufacturer.Sales_Rep__c,
    }));

    const combinedRecords = mappedAccounts.flatMap((account) =>
      mappedManufacturers
        .filter((manufacturer) =>
          account.manufacturersNames.includes(
            manufacturer.manufacturerName.trim()
          )
        )
        .map((manufacturer) => ({
          accountId: account.accountId,
          accountName: account.accountName,
          manufacturerId: manufacturer.manufacturerId,
          manufacturerName: manufacturer.manufacturerName,
          manufacturerSalesRep: manufacturer.manufacturerSalesRep,
        }))
    );

    // console.log("Combined Records:", combinedRecords);

    res.status(200).json({ combinedRecords });
  } catch (error) {
    console.error("Salesforce fetching Error:", error.message);
    res.status(500).json({ error: "Failed to Fetch data" });
  }
};
// for project
const getAllAccounts = async (req, res) => {
  const access_token = process.env.AccessToken;
  const instance_url = process.env.InstanceUrl;

  try {
    const query =
      "SELECT Id, Name, Active_Closed__c,Manufacturers_Names__c FROM Account WHERE Active_Closed__c = 'Active Account' ";

    const query2 = `SELECT Name,IsActive__c FROM Manufacturer__c`;

    const response = await axios.get(
      `${instance_url}/services/data/v57.0/query?q=${encodeURIComponent(
        query
      )}`,
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json",
        },
      }
    );
    res.status(200).json(response.data);
    // console.log(response)
  } catch (error) {
    console.error("Salesforce fetching Error:", error.message);
    res.status(500).json({ error: "Failed to Fetch data" });
  }
};

const getAccountByName = async (req, res) => {
  const access_token = process.env.AccessToken;
  const instance_url = process.env.InstanceUrl;
  const { name } = req.body;
  console.log(name);

  try {
    // First query: Fetch Account and Account Manufacturers
    const accountQuery = `
      SELECT Id, Name, Active_Closed__c, 
             (SELECT Id, Active_Closed__c, ManufacturerName__c, Sales_Rep__c 
              FROM Account_Manufacturers__r 
              WHERE Active_Closed__c = 'Active Account') 
      FROM Account 
      WHERE Name = '${name}'
    `;
    const accountResponse = await axios.get(
      `${instance_url}/services/data/v57.0/query?q=${encodeURIComponent(
        accountQuery
      )}`,
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json",
        },
      }
    );

    // Second query: Fetch Manufacturers with a non-null Minimum_Order_Amount__c
    const accountName = accountResponse.data.records[0].Name;
    console.log("account ", accountName);

    // Second query: Fetch Manufacturers with a non-null Minimum_Order_Amount__c
    const manufacturerQuery = `
      SELECT Name, Minimum_Order_Amount__c 
      FROM Manufacturer__c 
      WHERE Minimum_Order_Amount__c != null
    `;
    const manufacturerResponse = await axios.get(
      `${instance_url}/services/data/v57.0/query?q=${encodeURIComponent(
        manufacturerQuery
      )}`,
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json",
        },
      }
    );

    // Combine both results
    const result = {
      accounts: accountResponse.data.records,
      manufacturers: manufacturerResponse.data.records,
    };

    // Send combined data
    res.status(200).json(result);
  } catch (error) {
    console.error("Salesforce fetching error:", error.message);
    res.status(500).json({ error: "Failed to fetch data" });
  }
};

// for projects
const getProduct = async (req, res) => {
  const access_token = process.env.AccessToken;
  const instance_url = process.env.InstanceUrl;
  const { manufacturer, orderType, accountId } = req.body; // Include accountId in request body
  let categoryCondition = "";

  if (orderType === "Pre Orders") {
    categoryCondition = `AND Product2.Category__c = 'PREORDER'`;
  } else {
    categoryCondition = `AND Product2.Category__c != 'PREORDER'`;
  }

  try {
    // Query 1: Fetch Margin__c for the specified Account and Manufacturer
    const marginQuery = `
      SELECT Margin__c 
      FROM Account_Manufacturer__c 
      WHERE ManufacturerName__c = '${manufacturer}' 
      AND AccountId__c = '${accountId}'
    `;

    const marginResponse = await axios.get(
      `${instance_url}/services/data/v57.0/query?q=${encodeURIComponent(
        marginQuery
      )}`,
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json",
        },
      }
    );

    // Get the Margin value from the response
    const margin = marginResponse.data.records[0]?.Margin__c || null;

    // Query 2: Fetch Product and PricebookEntry data
    const productQuery = `
      SELECT 
          Product2.ProductCode, 
          Product2.ProductUPC__c, 
          Product2.IsActive, 
          Product2.Name, 
          Product2.Category__c, 
          Product2.ManufacturerName__c, 
          Product2.Min_Order_QTY__c, 
          Product2.Id, 
          UnitPrice
      FROM 
          PricebookEntry 
      WHERE 
          Pricebook2.IsActive = true 
          AND Product2.ManufacturerName__c = '${manufacturer}' 
          AND Product2.ProductCode != NULL 
          AND Product2.ProductUPC__c != NULL 
          AND Product2.Name != NULL 
          AND Product2.Category__c != NULL 
          AND IsActive = true
          ${categoryCondition}
    `;

    const productResponse = await axios.get(
      `${instance_url}/services/data/v57.0/query?q=${encodeURIComponent(
        productQuery
      )}`,
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json",
        },
      }
    );

    // Combine margin with each product
    // After getting productsWithMargin and images
    const productsWithMargin = await Promise.all(
      productResponse.data.records.map(async (product) => {
        // Retrieve ContentDocument IDs linked to the specific product
        const linkQuery = `SELECT ContentDocumentId FROM ContentDocumentLink WHERE LinkedEntityId = '${product.Product2.Id}'`;

        const linkResponse = await axios.get(
          `${instance_url}/services/data/v57.0/query?q=${encodeURIComponent(
            linkQuery
          )}`,
          {
            headers: {
              Authorization: `Bearer ${access_token}`,
              "Content-Type": "application/json",
            },
          }
        );

        const contentDocumentIds = linkResponse.data.records.map(
          (link) => link.ContentDocumentId
        );

        let images = [];
        if (contentDocumentIds.length > 0) {
          const contentDocumentIdList = contentDocumentIds
            .map((id) => `'${id}'`)
            .join(",");

          const versionQuery = `SELECT Id, ContentDocumentId, VersionData FROM ContentVersion WHERE ContentDocumentId IN (${contentDocumentIdList})`;

          const versionResponse = await axios.get(
            `${instance_url}/services/data/v57.0/query?q=${encodeURIComponent(
              versionQuery
            )}`,
            {
              headers: {
                Authorization: `Bearer ${access_token}`,
                "Content-Type": "application/json",
              },
            }
          );

          // Fetch images as Base64 encoded URLs
          images = await Promise.all(
            versionResponse.data.records.map(async (version) => {
              const imageUrl = `https://beautyfashionsales--dx.sandbox.my.salesforce.com/${version.VersionData}`;
              try {
                // Fetch the binary data of the image
                const imageResponse = await axios.get(imageUrl, {
                  headers: {
                    Authorization: `Bearer ${access_token}`,
                  },
                  responseType: "arraybuffer",
                });

                // Convert the binary data to Base64
                const base64Data = Buffer.from(
                  imageResponse.data,
                  "binary"
                ).toString("base64");

                return {
                  id: version.Id,
                  contentDocumentId: version.ContentDocumentId,
                  imageUrl: `data:image/png;base64,${base64Data}`, // Embed Base64 data
                };
              } catch (error) {
                console.error(
                  `Failed to fetch image for version ${version.Id}:`,
                  error
                );
                return null; // or handle the error appropriately
              }
            })
          );

          // Filter out any null values from the images array
          images = images.filter((img) => img !== null);
        }

        return {
          ...product,
          Margin__c: margin,
          images, // Add images to the product details
        };
      })
    );
    res.status(200).json(productsWithMargin);
  } catch (error) {
    console.error("Salesforce fetching Error:", error.message);
    res.status(500).json({ error: "Failed to Fetch data" });
  }
};

const getAccountAddress = async (req, res) => {
  const access_token = process.env.AccessToken;
  const instance_url = process.env.InstanceUrl;
  const { id } = req.body;
  try {
    const orderDetails = `
    SELECT Name, ShippingStreet, ShippingCity, ShippingState, ShippingPostalCode, ShippingCountry
    FROM Account
    WHERE Id = '${id}'`;

    const response = await axios.get(
      `${instance_url}/services/data/v57.0/query?q=${encodeURIComponent(
        orderDetails
      )}`,
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json",
        },
      }
    );
    res.status(200).json(response.data.records);
  } catch (error) {
    console.error("Salesforce fetching Error:", error.message);
    res.status(500).json({ error: "Failed to Fetch data" });
  }
};

const OrderPunch = async (req, res) => {
  const access_token = process.env.AccessToken;
  const instance_url = process.env.InstanceUrl;

  const { AccountInfo, ProductDetails } = req.body;
  const AccountId = AccountInfo.attributes.url.split("/")[6]; // Extract AccountId from URL
  const ManuFacturerName = AccountInfo.Manufacturer;

  try {
    // STEP - 1  Set a oppertunity Data from account details
    const manufacturerIdQuery = `SELECT ManufacturerId__c 
                                 FROM Product2 
                                 WHERE ManufacturerName__c = '${ManuFacturerName}'`;

    const ManuFacturerID = await axios.get(
      `${instance_url}/services/data/v57.0/query?q=${encodeURIComponent(
        manufacturerIdQuery
      )}`,
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json",
        },
      }
    );

    const opportunityData = {
      AccountId: AccountId,
      Name: AccountInfo.Name,
      StageName: "Closed Won",
      CloseDate: new Date().toISOString().slice(0, 10),
      Type: "Wholesale Numbers",
      // Amount: ProductDetails.totalPrice,
      ManufacturerId__c: ManuFacturerID.data.records[0].ManufacturerId__c,
      PO_Number__c: AccountInfo.poNum,
      Shipping_City__c: AccountInfo.ShippingCity,
      Shipping_Country__c: AccountInfo.ShippingCountry,
      Shipping_State__c: AccountInfo.ShippingCountry,
      Shipping_Street__c: AccountInfo.ShippingState,
      Shipping_Zip__c: AccountInfo.ShippingPostalCode,
    };
    // console.log("oppdata", opportunityData);
    const opportunityResponse = await axios.post(
      `${instance_url}/services/data/v57.0/sobjects/Opportunity`,
      opportunityData,
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json",
        },
      }
    );
    const opportunityId = opportunityResponse.data.id;

    // STEP - 2  Set a Products in OpportunityLineItems  from Products
    const productsData = Object.values(ProductDetails)
      .filter((product) => product.Product2) // Ensure product.Product2 exists
      .map((product) => {
        const productId = product.Product2?.attributes?.url?.split("/")[6];
        const listPrice = product.UnitPrice * (1 - product.Margin__c / 100);
        const totalPrice = listPrice * product.quantity; // Calculate TotalPrice
        return {
          OpportunityId: opportunityId,
          Product2Id: productId,
          Quantity: product.quantity,
          // UnitPrice: product.UnitPrice,
          // ListPrice: listPrice,
          TotalPrice: totalPrice,
        };
      });

    // console.log("product data", productsData);
    const productPromises = productsData.map((product) =>
      axios.post(
        `${instance_url}/services/data/v57.0/sobjects/OpportunityLineItem`,
        product,
        {
          headers: {
            Authorization: `Bearer ${access_token}`,
            "Content-Type": "application/json",
          },
        }
      )
    );

    await Promise.all(productPromises);
    console.log("Order Punch done", opportunityId);

    res.status(200).json({
      success: true,
      message:
        "Order punched successfully with Opportunity, Products, and Shipping",
      opportunityId,
    });
  } catch (error) {
    console.error(
      "Salesforce Order Punch Error:",
      error.response?.data || error.message
    );
    res.status(500).json({ error: "Failed to punch order" });
  }
};

// test queries
const getImage = async (req, res) => {
  const access_token = process.env.AccessToken;
  const instance_url = process.env.InstanceUrl;
  const orgId = process.env.SF_ORGID;
  const ProductID = "0053b00000DgAVKAA3"; // from content version
  try {
    // Step 1: Retrieve ContentDocument IDs linked to the specific product
    const productId = "01tO8000007GAXFIA4"; // Replace with the actual Product2 ID
    const linkQuery = `SELECT ContentDocumentId FROM ContentDocumentLink WHERE LinkedEntityId = '${productId}'`;

    const linkResponse = await axios.get(
      `${instance_url}/services/data/v57.0/query?q=${encodeURIComponent(
        linkQuery
      )}`,
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json",
        },
      }
    );
    // console.log(linkResponse);

    const contentDocumentIds = linkResponse.data.records.map(
      (link) => link.ContentDocumentId
    );
    if (contentDocumentIds.length === 0) {
      return res
        .status(404)
        .json({ error: "No images found for this product." });
    }

    // Step 2: Use ContentDocumentIds to fetch the image URLs from ContentVersion
    const contentDocumentIdList = contentDocumentIds
      .map((id) => `'${id}'`)
      .join(",");
    const versionQuery = `SELECT Id, ContentDocumentId, VersionData FROM ContentVersion WHERE ContentDocumentId IN (${contentDocumentIdList})`;

    const versionResponse = await axios.get(
      `${instance_url}/services/data/v57.0/query?q=${encodeURIComponent(
        versionQuery
      )}`,
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json",
        },
      }
    );
    console.log("version", versionResponse.data);

    // Step 3: Map version data to image URLs
    // Binary url = `https://beautyfashionsales--dx.sandbox.my.salesforce.com/${version.VersionData}`
    const images = versionResponse.data.records.map((version) => {
      console.log(version);
      return {
        contentDocumentId: version.ContentDocumentId,
        imageUrl: `https://beautyfashionsales--dx.sandbox.file.force.com/sfc/dist/version/download/?oid=${orgId}&ids=${version.ContentDocumentId}&d=${version.VersionData}&asPdf=false`, // Use version.Id or the appropriate document path here
      };
    });

    // const images = versionResponse.data.records.map((version) => {
    //   const imageUrl = `https://beautyfashionsales--dx.sandbox.my.salesforce.com/${version.VersionData}`;
    //   return {
    //     id: version.Id,
    //     contentDocumentId: version.ContentDocumentId,
    //     imageUrl: imageUrl, // Constructed download URL
    //   };
    // });

    // Step 4: Respond with the images
    res.status(200).json(images);
  } catch (error) {
    console.error("Salesforce API Error:", error.message);
    res.status(500).json({ error: "Failed to fetch product images" });
  }
};

const base64 = async (req, res) => {
  const url =
    "https://beautyfashionsales--dx.sandbox.my.salesforce.com//services/data/v57.0/sobjects/ContentVersion/068O80000051K6jIAE/VersionData";
  const access_token = process.env.AccessToken;
  try {
    // Make a GET request to Salesforce to retrieve the binary data
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
      responseType: "arraybuffer", // Keep the data in binary format
    });

    // Convert the binary data to Base64
    const base64Data = Buffer.from(response.data, "binary").toString("base64");

    // Send the Base64 data as a response
    res.json({ base64: `data:image/png;base64,${base64Data}` });
  } catch (error) {
    console.error(error);
    res.status(500).send("Failed to retrieve or process the file.");
  }
};

const downloadUrl = async (req, res) => {
  const imageUrl =
    "https://beautyfashionsales--dx.sandbox.my.salesforce.com//services/data/v57.0/sobjects/ContentVersion/068O80000051K6jIAE/VersionData"; // URL of the image requiring a token
  const access_token = process.env.AccessToken;
  const shouldDownload = req.query.download === "true"; // Check if download is requested

  try {
    // Fetch the image with the token
    const response = await axios.get(imageUrl, {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
      responseType: "arraybuffer",
    });

    // Set appropriate headers
    res.setHeader("Content-Type", response.headers["content-type"]);
    if (shouldDownload) {
      res.setHeader("Content-Disposition", 'attachment; filename="image.jpg"');
    }

    // Send the image data
    res.send(response.data);
  } catch (error) {
    console.error("Error fetching image:", error);
    res.status(500).send("Failed to fetch image");
  }
};

const getDiscount = async (req, res) => {
  const access_token = process.env.AccessToken;
  const instance_url = process.env.InstanceUrl;
  try {
    const query1 = `SELECT 
      Margin__c, AccountId__c,ManufacturerName__c 
      FROM Account_Manufacturer__c 
      WHERE ManufacturerName__c = 'RMS BEAUTY' 
      AND AccountId__c = '0011400001dEI2OAAW'
       `;

    const query2 = `SELECT Id,Name,ProductCode,ProductUPC__c,IsActive,ManufacturerName__c FROM Product2 WHERE ManufacturerName__c = 'Flit Sync 1'`;
    const query4 = `SELECT Name,IsActive__c FROM Manufacturer__c`;
    const query = `SELECT FileUrl__c FROM ProductImage__c `;
    const query3 = `SELECT FileExtension,CreatedById,Id,Title,VersionData FROM ContentVersion`;

    const response = await axios.get(
      `${instance_url}/services/data/v57.0/query?q=${encodeURIComponent(
        query3
      )}`,
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json",
        },
      }
    );
    res.status(200).json(response.data);
  } catch (error) {
    console.error("Salesforce fetching Error:", error.message);
    res.status(500).json({ error: "Failed to Fetch data" });
  }
};

// test query
const testQuery = async (req, res) => {
  const access_token = process.env.AccessToken;
  const instance_url = process.env.InstanceUrl;
  try {
    const minOrderFind = `SELECT Id,ManufacturerName__c,ManufacturerId__c
    FROM Product2 
    WHERE ManufacturerName__c = 'Flit Sync 1'`;
    const margin = `SELECT Tester_Margin__c FROM Product2 WHERE Tester_Margin__c != null`;
    const orderDetails = `
    SELECT Name, ShippingStreet, ShippingCity, ShippingState, ShippingPostalCode, ShippingCountry
    FROM Account
    WHERE Id = '0013b000025Eq3XAAS'`;
    const orderCheck = `SELECT ListPrice,Name,OpportunityId,Product2Id,ProductCode,Quantity,UnitPrice,Subtotal,TotalPrice FROM OpportunityLineItem `;
    const oppor = `SELECT AccountId,Account_Manufacturer__c,ManufacturerId__c,Season__c,Shipping_City__c,OwnerId,Shipping_Country__c FROM Opportunity WHERE AccountId = '0013b000025Eq3XAAS' `;

    const customerSHipping = `SELECT AccountId,Name,ShippingAddress FROM Order`;

    const response = await axios.get(
      `${instance_url}/services/data/v57.0/query?q=${encodeURIComponent(
        orderCheck
      )}`,
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json",
        },
      }
    );
    res.status(200).json(response.data);
  } catch (error) {
    console.error("Salesforce fetching Error:", error.message);
    res.status(500).json({ error: "Failed to Fetch data" });
  }
};

module.exports = {
  login,
  accountDetails,
  getAllAccounts,
  getAccountByName,
  getProduct,
  getDiscount,
  getImage,
  base64,
  downloadUrl,
  testQuery,
  getAccountAddress,
  OrderPunch,
};

// src="https://beautyfashionsales.file.force.com/sfc/dist/version/download/?oid=00D30000001G9fh&ids=068Rb000001uLly&d=%2Fa%2FRb000000CauA%2Fgv7_V1voXXFKik8OZNws5CoKjQvuKt9rBwwpxgxaMk0&asPdf=false"

// https://beautyfashionsales.file.force.com/sfc/dist/version/download/?oid=00D30000001G9fh&ids=068Rb000001uLkL&d=%2Fa%2FRb000000Caqv%2FF7Un3PuDLghogAt6fjG.F3NJpPvJ5_8mnGvnF_Wu7Z0&asPdf=false

// https://beautyfashionsales--dx.sandbox.file.force.com/sfc/dist/version/download/?oid=00DO8000001NKS5&ids=069O8000004w39lIAA&d=/services/data/v57.0/sobjects/ContentVersion/068O80000051K6jIAE/VersionData&asPdf=false

// https://beautyfashionsales--dx.sandbox.my.salesforce.com/services/data/v57.0/sobjects/ContentVersion/068O8000003eCQYIA2/VersionData

// https://beautyfashionsales--dx.sandbox.my.salesforce.com/sfc/dist/version/download/?oid=00DO8000001NKS5&ids=069O8000003i58jIAA&d=/services/data/v57.0/sobjects/ContentVersion/068O8000003eF9tIAE/VersionData&asPdf=false

// [
//   {
//     "attributes": {
//       "type": "ContentDocumentLink",
//       "url": "/services/data/v57.0/sobjects/ContentDocumentLink/06AO8000003nxdBMAQ"
//     },
//     "Id": "06AO8000003nxdBMAQ",
//     "ContentDocumentId": "069O8000003Y8ZWIA0",
//     "LinkedEntityId": "01t1O000006JgLoQAK"
//   }
// ]
