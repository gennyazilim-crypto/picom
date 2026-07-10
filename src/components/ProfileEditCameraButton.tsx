import { AppIcon } from "./AppIcon";

export function ProfileEditCameraButton({ onClick }: { onClick?: () => void }) {
  return (
    <button
      type="button"
      className="profile-edit-camera-button"
      aria-label="Change profile photo"
      title="Change profile photo"
      onClick={onClick}
    >
      <AppIcon name="image" size="sm" />
    </button>
  );
}
