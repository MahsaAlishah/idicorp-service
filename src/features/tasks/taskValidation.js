export const TITLE_LIMIT = 120;
export const DESCRIPTION_LIMIT = 2000;

export function validateTask(values, partial = false) {
  const errors = {};
  if (!partial || 'title' in values) {
    if (typeof values.title !== 'string' || !values.title.trim()) {
      errors.title = 'Enter a title.';
    } else if (Array.from(values.title).length > TITLE_LIMIT) {
      errors.title = 'Title must be 120 characters or fewer.';
    }
  }
  if ('description' in values && (typeof values.description !== 'string' ||
      Array.from(values.description).length > DESCRIPTION_LIMIT)) {
    errors.description = 'Description must be 2,000 characters or fewer.';
  }
  if ('completed' in values && typeof values.completed !== 'boolean') {
    errors.completed = 'Choose a valid completion status.';
  }
  return errors;
}
