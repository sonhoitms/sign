/** @odoo-module **/

import { _t } from "@web/core/l10n/translation";
import { Dialog } from "@web/core/dialog/dialog";
import { Component } from "@odoo/owl";
import { useService } from '@web/core/utils/hooks';

export class SignOcaDialog extends Component {
    setup() {
        super.setup();
        this.info = this.props.info;
        this.item = this.props.item;
        this.size = this.props.size;
        this.orm = useService('orm');
        this.items = Object.values(this.info.items);
    }

    opened (handler) {
        return (handler)? this._opened.then(handler) : this._opened;
    }

    /**
     * Show a dialog
     *
     * @param {Object} options
     * @param {boolean} options.shouldFocusButtons  if true, put the focus on
     * the first button primary when the dialog opens
     */
    open (options) {
        $('.tooltip').remove(); // remove open tooltip if any to prevent them staying when modal is opened

        var self = this;
        this.appendTo($('<div/>')).then(function () {
            if (self.isDestroyed()) {
                return;
            }
            self.$modal.find(".modal-body").replaceWith(self.$el);
            self.$modal.attr('open', true);
            if (self.$parentNode) {
                self.$modal.appendTo(self.$parentNode);
            }
            const modalNode = self.$modal[0];
            const modal = new Modal(modalNode, {
                backdrop: self.backdrop,
                keyboard: false,
            });
            modal.show();
            self._openedResolver();
            if (options && options.shouldFocusButtons) {
                self._onFocusControlButton();
            }

            // Notifies OwlDialog to adjust focus/active properties on owl dialogs
            OwlDialog.display(self);

            // Notifies new webclient to adjust UI active element
            core.bus.trigger("legacy_dialog_opened", self);
        });

        return self;
    }
    close () {
        this.destroy();
    }

    /**
     * Close and destroy the dialog.
     *
     * @param {Object} [options]
     * @param {Object} [options.infos] if provided and `silent` is unset, the
     *   `on_close` handler will pass this information related to closing this
     *   information.
     * @param {boolean} [options.silent=false] if set, do not call the
     *   `on_close` handler.
     */
    destroy (options) {
        // Need to trigger before real destroy but if 'closed' handler destroys
        // the widget again, we want to avoid infinite recursion
        if (!this.__closed) {
            this.__closed = true;
            this.trigger('closed', options);
        }

        if (this.isDestroyed()) {
            return;
        }

        // Notifies OwlDialog to adjust focus/active properties on owl dialogs.
        // Only has to be done if the dialog has been opened (has an el).
        if (this.el) {
            OwlDialog.hide(this);

            // Notifies new webclient to adjust UI active element
            core.bus.trigger("legacy_dialog_destroyed", this);
        }

        // Triggers the onForceClose event if the callback is defined
        if (this.onForceClose) {
            this.onForceClose();
        }
        var isFocusSet = this._focusOnClose();

        this._super();

        $('.tooltip').remove(); //remove open tooltip if any to prevent them staying when modal has disappeared
        if (this.$modal) {
            if (this.on_detach_callback) {
                this.on_detach_callback();
            }
            this.$modal.modal('hide');
            this.$modal.remove();
        }

        const modals = $('.modal[role="dialog"]').filter(':visible').filter(this._isBlocking);
        if (modals.length) {
            if (!isFocusSet) {
                modals.last().focus();
            }
            // Keep class modal-open (deleted by bootstrap hide fnct) on body to allow scrolling inside the modal
            $('body').addClass('modal-open');
        }
    }
    /**
     * adds the keydown behavior to the dialogs after external files modifies
     * its DOM.
     */
    rebindButtonBehavior() {
        this.$footer.on('keydown', this._onFooterButtonKeyDown);
    }
    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------
    /**
     * Manages the focus when the dialog closes. The default behavior is to set the focus on the top-most opened popup.
     * The goal of this function is to be overridden by all children of the dialog class.
     *
     * @returns: boolean  should return true if the focus has already been set else false.
     */
    _focusOnClose() {
        return false;
    }
    /**
     * Render and set the given buttons into a target element
     *
     * @private
     * @param {jQueryElement} $target The destination of the rendered buttons
     * @param {Array} buttons The array of buttons to render
     */
    _setButtonsTo($target, buttons) {
        var self = this;
        $target.empty();
        _.each(buttons, function (buttonData) {
            var $button = dom.renderButton({
                attrs: {
                    class: buttonData.classes || (buttons.length > 1 ? 'btn-secondary' : 'btn-primary'),
                    disabled: buttonData.disabled,
                    'data-hotkey': buttonData.hotkey,
                },
                icon: buttonData.icon,
                text: buttonData.text,
            });
            $button.on('click', function (e) {
                var def;
                if (buttonData.click) {
                    def = buttonData.click.call(self, e);
                }
                if (buttonData.close) {
                    self.onForceClose = false;
                    Promise.resolve(def).then(self.close.bind(self));
                }
            });
            if (self.technical) {
                $target.append($button);
            } else {
                $target.prepend($button);
            }
        });
    }
    /**
     * Returns false for non-"blocking" dialogs.
     * This is intended to be overridden by subclasses.
     *
     * @private
     * @param {int} index
     * @param {element} el The element of a dialog.
     * @returns {boolean}
     */
    _isBlocking(index, el) {
        return true;
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------
    /**
     * @private
     */
    _onCloseDialog(ev) {
        ev.stopPropagation();
        this.close();
    }
    /**
     * Moves the focus to the first button primary in the footer of the dialog
     *
     * @private
     * @param {odooEvent} e
     */
    _onFocusControlButton (e) {
        if (this.$footer) {
            if (e) {
                e.stopPropagation();
            }
            this.$footer.find('.btn-primary:visible:first()').focus();
        }

    }
    /**
     * Manages the TAB key on the buttons. If you the focus is on a primary
     * button and the users tries to tab to go to the next button, display
     * a tooltip
     *
     * @param {jQueryEvent} e
     * @private
     */
    _onFooterButtonKeyDown (e) {
        switch(e.which) {
            case $.ui.keyCode.TAB:
                if (!e.shiftKey && e.target.classList.contains("btn-primary")) {
                    e.preventDefault();
                    var $primaryButton = $(e.target);
                    $primaryButton.tooltip({
                        delay: {show: 200, hide:0},
                        title: function(){
                            return QWeb.render('FormButton.tooltip',{title:$primaryButton.text().toUpperCase()});
                        },
                        trigger: 'manual',
                    });
                    $primaryButton.tooltip('show');
                }
                break;
        }
    }
    save() {
        var el = document.getElementsByClassName('o_sign_oca_field_edition');
        this.dialog = document.querySelector("div[role='dialog']")
        if (el) {
            
            var field_id = parseInt(
                $(el).find('select[name="field_id"]').val(),
                10
            );
            var role_id = parseInt(
                $(el).find('select[name="role_id"]').val(),
                10
            );
            var required = $(el)
                .find("input[name='required']")
                .prop("checked");
            var placeholder = $(el)
                .find("input[name='placeholder']")
                .val();
            this.orm.call(this.props.model, "set_item_data", [
                        [this.props.res_id],
                        this.item.id,
                        {
                            field_id,
                            role_id,
                            required,
                            placeholder,
                        },
                    ],
                )
                .then(() => {
                    this.item.field_id = field_id;
                    this.item.name = this.info.fields.filter((field) => field.id === field_id)[0].name;
                    this.item.role_id = role_id;
                    this.item.required = required;
                    this.item.placeholder = placeholder;
                    this.dialog.remove();
                    this.props.SignOcaConfigure.postIframeField(this.item);
                });
            }
        }
    delete() {
        this.dialog = document.querySelector("div[role='dialog']")
        this.orm.call(this.props.model, "delete_item", [
            [this.props.res_id],
            this.item.id,
        ]).then(() => {
            this.dialog.remove();
            this.props.SignOcaConfigure.postIframeField(this.item);
            location.reload();
        });
    }
    cancel() {
        this.dialog = document.querySelector("div[role='dialog']")
        this.dialog.remove();
    }
}

SignOcaDialog.components = {
    Dialog,
};
SignOcaDialog.template = "sign_oca.SignOcaDialog";