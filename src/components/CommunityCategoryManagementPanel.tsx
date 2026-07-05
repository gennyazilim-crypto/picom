import { useState } from "react";
import type { Community, Member } from "../types/community";
import { AppIcon } from "./AppIcon";

type CommunityCategoryManagementPanelProps = {
  community: Community;
  currentUser: Member;
  onCreateCategory: (name: string) => void;
  onRenameCategory: (categoryId: string, name: string) => void;
  onDeleteCategory: (categoryId: string) => void;
};

function canManageCategories(community: Community, currentUser: Member): boolean {
  const role = community.roles.find((candidate) => candidate.id === currentUser.roleId);
  return Boolean(role && (role.name === "Owner" || role.name === "Admin" || role.level >= 80));
}

export function CommunityCategoryManagementPanel({ community, currentUser, onCreateCategory, onRenameCategory, onDeleteCategory }: CommunityCategoryManagementPanelProps) {
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  if (!canManageCategories(community, currentUser)) {
    return null;
  }

  function createCategory() {
    const name = newCategoryName.trim();
    if (!name) return;
    onCreateCategory(name);
    setNewCategoryName("");
  }

  function startEdit(categoryId: string, name: string) {
    setEditingCategoryId(categoryId);
    setEditingName(name);
  }

  function saveEdit() {
    if (!editingCategoryId || !editingName.trim()) return;
    onRenameCategory(editingCategoryId, editingName.trim());
    setEditingCategoryId(null);
    setEditingName("");
  }

  return (
    <section className="category-management-card" aria-label="Channel category management placeholder">
      <div className="category-management-head">
        <span>
          <AppIcon name="settings" size="sm" />
        </span>
        <div>
          <strong>Categories</strong>
          <small>Owner/Admin local management.</small>
        </div>
      </div>
      <div className="category-management-create">
        <input value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} placeholder="New category" aria-label="New category name" />
        <button type="button" disabled={!newCategoryName.trim()} onClick={createCategory}>Add</button>
      </div>
      <div className="category-management-list">
        {community.categories.map((category) => (
          <div key={category.id} className="category-management-row">
            {editingCategoryId === category.id ? (
              <input value={editingName} onChange={(event) => setEditingName(event.target.value)} aria-label={`Rename ${category.name}`} />
            ) : (
              <span>{category.name}</span>
            )}
            {editingCategoryId === category.id ? (
              <button type="button" onClick={saveEdit}>Save</button>
            ) : (
              <button type="button" onClick={() => startEdit(category.id, category.name)}>Edit</button>
            )}
            <button type="button" disabled={community.categories.length <= 1} onClick={() => onDeleteCategory(category.id)}>Delete</button>
          </div>
        ))}
      </div>
      <small className="category-management-note">Deleting a category moves its channels to the first remaining category.</small>
    </section>
  );
}