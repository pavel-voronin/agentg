export type FileDownload = {
  addDate: Date;
  completeDate: Date;
  fileId: number;
  isPaused: boolean;
  messageChatId: string;
  messageId: string;
};

export type FileDownloadPatch = {
  completeDate: Date;
  fileId: number;
  isPaused: boolean;
};
