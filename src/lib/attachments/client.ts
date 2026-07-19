export async function uploadMessageFiles(input: {
  scope: "support" | "evaluation";
  parentId: string;
  files: File[];
}) {
  for (const file of input.files.slice(0, 2)) {
    const metadata = {
      scope: input.scope,
      parentId: input.parentId,
      fileName: file.name,
      contentType: file.type,
      sizeBytes: file.size,
    };
    const presignResponse = await fetch("/api/attachments/presign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(metadata),
    });
    const presign = await presignResponse.json();
    if (!presignResponse.ok) throw new Error(presign.error ?? "upload_unavailable");
    const uploadResponse = await fetch(presign.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });
    if (!uploadResponse.ok) throw new Error("r2_upload_failed");
    const completeResponse = await fetch("/api/attachments/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...metadata, objectKey: presign.objectKey }),
    });
    const completed = await completeResponse.json();
    if (!completeResponse.ok) throw new Error(completed.error ?? "upload_unavailable");
  }
}
