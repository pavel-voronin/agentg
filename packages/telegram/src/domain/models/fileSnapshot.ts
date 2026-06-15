export type FileSnapshot = {
  expectedSize: number;
  id: number;
  local: {
    can_be_deleted: boolean;
    can_be_downloaded: boolean;
    download_offset: number;
    downloaded_prefix_size: number;
    downloaded_size: number;
    is_downloading_active: boolean;
    is_downloading_completed: boolean;
    path: string;
  };
  remote: {
    id: string;
    is_uploading_active: boolean;
    is_uploading_completed: boolean;
    unique_id: string;
    uploaded_size: number;
  };
  size: number;
};
