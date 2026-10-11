import React, { useState } from 'react';
import { Layers, Plus, Edit2, Trash2, Check, X, Tag } from 'lucide-react';
import { AppStore, Category, CategoryGroup, CategoryType } from '../types';

interface CategoriesViewProps {
  store: AppStore;
  onSaveCategory: (cat: Partial<Category>) => void;
  onDeleteCategory: (id: number) => void;
  onSaveGroup: (grp: Partial<CategoryGroup>) => void;
}

export const CategoriesView: React.FC<CategoriesViewProps> = ({
  store,
  onSaveCategory,
  onDeleteCategory,
  onSaveGroup,
}) => {
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  // Category form
  const [catName, setCatName] = useState('');
  const [catGroupId, setCatGroupId] = useState<number>(store.category_groups[0]?.id || 1);
  const [catType, setCatType] = useState<CategoryType>('expense');

  const handleOpenAddCat = (defaultGroupId?: number) => {
    setCatName('');
    setCatGroupId(defaultGroupId || store.category_groups[0]?.id || 1);
    const grp = store.category_groups.find((g) => g.id === (defaultGroupId || 1));
    setCatType(grp?.name === 'Доходы' ? 'income' : 'expense');
    setEditingCategory(null);
    setIsCatModalOpen(true);
  };

  const handleOpenEditCat = (cat: Category) => {
    setCatName(cat.name);
    setCatGroupId(cat.group_id ?? store.category_groups[0]?.id ?? 1);
    setCatType(cat.type);
    setEditingCategory(cat);
    setIsCatModalOpen(true);
  };

  const handleSubmitCat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;

    onSaveCategory({
      ...(editingCategory ? { id: editingCategory.id } : {}),
      name: catName.trim(),
      group_id: catGroupId,
      type: catType,
      is_active: true,
    });

    setIsCatModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-white">Категории и группы расходов/доходов</h2>
          <p className="text-xs text-slate-400">
            Структурирование бюджета по разделам: Обязательные траты, Необязательные траты, Доходы.
          </p>
        </div>

        <button
          onClick={() => handleOpenAddCat()}
          className="px-3.5 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Новая категория</span>
        </button>
      </div>

      {/* Category Groups Columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {store.category_groups.map((group) => {
          const groupCategories = store.categories.filter((c) => c.group_id === group.id);

          return (
            <div key={group.id} className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-white">{group.name}</h3>
                  <span className="text-xs text-slate-500 font-mono">
                    {groupCategories.length} категорий
                  </span>
                </div>
                <button
                  onClick={() => handleOpenAddCat(group.id)}
                  className="p-1.5 rounded-lg bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
                  title="Добавить категорию в группу"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-2">
                {groupCategories.map((cat) => {
                  const txCount = store.transactions.filter((tx) => tx.category_id === cat.id).length;

                  return (
                    <div
                      key={cat.id}
                      className="p-3 bg-slate-950 rounded-lg border border-slate-800/80 hover:border-slate-700 transition-colors flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-2.5">
                        <Tag className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400 transition-colors" />
                        <span className="text-xs font-medium text-slate-200">{cat.name}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-500 font-mono">
                          {txCount} оп.
                        </span>
                        <button
                          onClick={() => handleOpenEditCat(cat)}
                          className="p-1 rounded text-slate-500 hover:text-white"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Удалить категорию «${cat.name}»?`)) {
                              onDeleteCategory(cat.id);
                            }
                          }}
                          className="p-1 rounded text-slate-500 hover:text-rose-400"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Category Modal */}
      {isCatModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <h2 className="text-base font-semibold text-white">
                {editingCategory ? 'Редактировать категорию' : 'Новая категория'}
              </h2>
              <button onClick={() => setIsCatModalOpen(false)} className="p-1 rounded text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitCat} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Название категории</label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="Например: Продукты, Кафе, Спортзал..."
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Группа категорий</label>
                <select
                  value={catGroupId}
                  onChange={(e) => {
                    const gid = Number(e.target.value);
                    setCatGroupId(gid);
                    const grp = store.category_groups.find((g) => g.id === gid);
                    if (grp?.name === 'Доходы') setCatType('income');
                    else setCatType('expense');
                  }}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-xs"
                >
                  {store.category_groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Тип</label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 border border-slate-800 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setCatType('expense')}
                    className={`py-1.5 text-xs font-medium rounded-md transition-colors ${
                      catType === 'expense'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Расход
                  </button>
                  <button
                    type="button"
                    onClick={() => setCatType('income')}
                    className={`py-1.5 text-xs font-medium rounded-md transition-colors ${
                      catType === 'income'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Доход
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCatModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  <span>Сохранить</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
