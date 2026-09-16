import React from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { Modal, Button } from '../ui';

interface DeleteConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  itemName?: string;
  confirmLabel?: string;
  isPending?: boolean;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  open,
  onClose,
  onConfirm,
  title,
  description,
  itemName,
  confirmLabel = 'تأكيد الحذف النهائي',
  isPending = false,
}) => {
  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="space-y-4 pt-2">
        <div className="flex items-start gap-3 p-4 rounded-xl bg-rose-50 border border-rose-200">
          <div className="w-9 h-9 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center flex-shrink-0 mt-0.5">
            <AlertTriangle size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-bold text-rose-900 mb-1">{title}</h4>
            <p className="text-xs text-rose-700 leading-relaxed">
              {description || 'هل أنت متأكد من تنفيذ عملية الحذف؟ لا يمكن التراجع عن هذا الإجراء.'}
            </p>
            {itemName && (
              <div className="mt-2.5 p-2 bg-white rounded-lg border border-rose-200 text-xs font-bold text-slate-800 break-words">
                {itemName}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isPending}
            className="text-xs border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            إلغاء
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="bg-rose-600 hover:bg-rose-700 text-white text-xs px-4 flex items-center gap-1.5 shadow-sm"
          >
            <Trash2 size={14} />
            {isPending ? 'جاري الحذف...' : confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
