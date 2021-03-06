import { Component, ViewChild, ViewContainerRef, ElementRef, EventEmitter, HostListener } from "@angular/core";
import { PositioningService, IDynamicClasses } from "../../../misc/util";
import { TransitionController, TransitionDirection, Transition } from "../../transition";
import { IPopup } from "../classes/popup-controller";
import { PopupConfig } from "../classes/popup-config";

@Component({
    selector: "sui-popup",
    template: `
<div class="ui popup"
     [ngClass]="dynamicClasses"
     [suiTransition]="transitionController"
     [attr.direction]="direction"
     #container>

    <ng-container *ngIf="!config.template && (!!config.header || !!config.text)">
        <div class="header" *ngIf="config.header">{{ config.header }}</div>
        <div class="content">{{ config.text }}</div>
    </ng-container>
    <div #templateSibling></div>

    <sui-popup-arrow *ngIf="!config.isBasic"
                     [placement]="positioningService.actualPlacement"
                     [inverted]="config.isInverted"></sui-popup-arrow>
</div>
`,
    styles: [`
.ui.popup {
    /* Autofit popup to the contents. */
    right: auto;
}

.ui.animating.popup {
    /* When the popup is animating, it may not initially be in the correct position.
       This fires a mouse event, causing the anchor's mouseleave to fire - making the popup flicker.
       Setting pointer-events to none while animating fixes this bug. */
    pointer-events: none;
}

.ui.popup::before {
    /* Hide the Semantic UI CSS arrow. */
    display: none;
}

/* Offset popup by 0.75em above and below when placed 'vertically'. */
.ui.popup[direction="top"],
.ui.popup[direction="bottom"] {
    margin-top: 0.75em;
    margin-bottom: 0.75em;
}

/* Offset popup by 0.75em either side when placed 'horizontally'. */
.ui.popup[direction="left"],
.ui.popup[direction="right"] {
    margin-left: 0.75em;
    margin-right: 0.75em;
}
`]
})
export class SuiPopup implements IPopup {
    // Config settings for this popup.
    public config:PopupConfig;

    public transitionController:TransitionController;
    public positioningService:PositioningService;

    // Keeps track of whether the popup is open internally.
    private _isOpen:boolean;
    // `setTimeout` timer pointer for cancelling popup close.
    private _closingTimeout:number;

    // Fires when the popup opens (and the animation is completed).
    public onOpen:EventEmitter<void>;
    // Fires when the popup closes (and the animation is completed).
    public onClose:EventEmitter<void>;

    public get isOpen():boolean {
        return this._isOpen;
    }

    // `ElementRef` for the positioning subject.
    @ViewChild("container", { read: ViewContainerRef })
    private _container:ViewContainerRef;

    public set anchor(anchor:ElementRef) {
        // Whenever the anchor is set (which is when the popup is created), recreate the positioning service with the appropriate options.
        this.positioningService = new PositioningService(anchor, this._container.element, this.config.placement, ".dynamic.arrow");
    }

    // Returns the direction (`top`, `left`, `right`, `bottom`) of the current placement.
    public get direction():string | undefined {
        if (this.positioningService) {
            return this.positioningService.actualPlacement.split(" ").shift();
        }
    }

    // Returns the alignment (`top`, `left`, `right`, `bottom`) of the current placement.
    public get alignment():string | undefined {
        if (this.positioningService) {
            return this.positioningService.actualPlacement.split(" ").pop();
        }
    }

    public get dynamicClasses():IDynamicClasses {
        const classes:IDynamicClasses = {};
        if (this.direction) {
            classes[this.direction] = true;
        }
        if (this.alignment) {
            classes[this.alignment] = true;
        }
        if (this.config.isInverted) {
            classes.inverted = true;
        }
        if (this.config.isBasic) {
            classes.basic = true;
        }
        return classes;
    }

    // `ViewContainerRef` for the element the template gets injected as a sibling of.
    @ViewChild("templateSibling", { read: ViewContainerRef })
    public templateSibling:ViewContainerRef;

    constructor(public elementRef:ElementRef) {
        this.transitionController = new TransitionController(false);

        this._isOpen = false;

        this.onOpen = new EventEmitter<void>();
        this.onClose = new EventEmitter<void>();
    }

    public open():void {
        // Only attempt to open if currently closed.
        if (!this.isOpen) {
            // Cancel the closing timer.
            clearTimeout(this._closingTimeout);

            // Cancel all other transitions, and initiate the opening transition.
            this.transitionController.stopAll();
            this.transitionController.animate(
                new Transition(this.config.transition, this.config.transitionDuration, TransitionDirection.In, () => {
                    // Focus any element with [autofocus] attribute.
                    const autoFocus = this.elementRef.nativeElement.querySelector("[autofocus]") as HTMLElement | null;
                    if (autoFocus) {
                        autoFocus.focus();
                        // Try to focus again when the modal has opened so that autofocus works in IE11.
                        setTimeout(() => autoFocus.focus(), this.config.transitionDuration);
                    }
                }));

            // Refresh the popup position after a brief delay to allow for browser processing time.
            this.positioningService.placement = this.config.placement;
            setTimeout(() => this.positioningService.update());

            // Finally, set the popup to be open.
            this._isOpen = true;
            this.onOpen.emit();
        }
    }

    public toggle():void {
        if (!this.isOpen) {
            return this.open();
        }

        return this.close();
    }

    public close():void {
        // Only attempt to close if currently open.
        if (this.isOpen) {
            // Cancel all other transitions, and initiate the closing transition.
            this.transitionController.stopAll();
            this.transitionController.animate(
                new Transition(this.config.transition, this.config.transitionDuration, TransitionDirection.Out));

            // Cancel the closing timer.
            clearTimeout(this._closingTimeout);
            // Start the closing timer, that fires the `onClose` event after the transition duration number of milliseconds.
            this._closingTimeout = window.setTimeout(() => this.onClose.emit(), this.config.transitionDuration);

            // Finally, set the popup to be closed.
            this._isOpen = false;
        }
    }

    @HostListener("mousedown", ["$event"])
    public onMouseDown(e:MouseEvent):void {
        e.preventDefault();
    }

    @HostListener("click", ["$event"])
    public onClick(event:MouseEvent):void {
        // Makes sense here, as the popup shouldn't be attached to any DOM element.
        event.stopPropagation();
    }
}
