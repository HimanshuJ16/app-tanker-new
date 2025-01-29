export const uploadImageToCloudinary = async (obj: any) => {
  const cloudName = "himanshujangir";
  const apiKey = "594334666294454";
  const apiSecret = "prRwTsNtBcPhRiye-szJviNsyYA";

  const timestamp = Math.floor(Date.now() / 1000);

  const formData = new FormData();
  console.log("obj=>", obj);

  formData.append("file", {
    uri: obj.uri,
    name: obj.fileName,
    type: obj.mimeType,
  } as any);

  formData.append("api_key", apiKey);
  formData.append("timestamp", timestamp.toString());

  console.log("formData=>", formData);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    {
      method: "POST",
      body: formData,
    }
  );

  const data = await response.json();

  if (response.ok) {
    console.log("data=>", data.secure_url);
    return data.secure_url;
  } else {
    console.log("error=>", data.error.message);
    return data.error.message;
  }
};

