export interface User {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    profile_picture_url?: string;
    phone_number?: string;
}

export interface UpdateProfileData {
    firstName?: string;
    lastName?: string;
    phone_number?: string;
}

export interface ChangePasswordData {
    current_password: string;
    new_password: string;
}

export interface UploadProfilePictureData {
    file_name: string;
    content_type: string;
}