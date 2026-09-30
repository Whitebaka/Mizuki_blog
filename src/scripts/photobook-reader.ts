class PhotobookReader extends HTMLElement {
	private controller?: AbortController;
	connectedCallback() {
		this.controller?.abort();
		this.controller = new AbortController();
		const { signal } = this.controller;
		const imageStatus = (img: HTMLImageElement, failed = false) => {
			const label = img.closest(".book-image")?.querySelector<HTMLElement>("[data-image-status]");
			if (!label) return;
			label.hidden = img.complete && img.naturalWidth > 0;
			label.textContent = failed ? "照片加载失败，请点图重试" : "正在加载照片…";
		};
		this.querySelectorAll<HTMLImageElement>(".book-image img").forEach(img => imageStatus(img, img.complete && !img.naturalWidth));
		this.addEventListener("load", event => { if (event.target instanceof HTMLImageElement) imageStatus(event.target); }, { signal, capture: true });
		this.addEventListener("error", event => { if (event.target instanceof HTMLImageElement) imageStatus(event.target, true); }, { signal, capture: true });
		const pages = [...this.querySelectorAll<HTMLElement>("[data-page]")];
		const controls = this.querySelector<HTMLElement>("[data-controls]")!;
		const pager = this.querySelector<HTMLElement>("[data-pager]")!;
		const previous = this.querySelector<HTMLButtonElement>("[data-prev]")!;
		const next = this.querySelector<HTMLButtonElement>("[data-next]")!;
		const progress = this.querySelector<HTMLElement>("[data-progress]")!;
		const chapter = this.querySelector<HTMLSelectElement>("[data-chapter]")!;
		const media = matchMedia("(max-width: 700px)");
		let mode = "scroll";
		let pageIndex = Math.max(0,pages.findIndex(p => p.id === location.hash.slice(1)));
		let figureIndex = 0;
		const figures = (p: HTMLElement) => [...p.querySelectorAll<HTMLElement>("[data-figure]")];
		const update = () => {
			this.dataset.mode = mode;
			pager.hidden = mode !== "book";
			for (const [i,p] of pages.entries()) {
				p.hidden = mode === "book" && i !== pageIndex;
				for (const [j,f] of figures(p).entries()) f.hidden = mode === "book" && media.matches && j !== figureIndex;
			}
			this.querySelectorAll<HTMLElement>("[data-mode]").forEach(b => b.setAttribute("aria-pressed",String(b.dataset.mode === mode)));
			const count = media.matches ? pages.reduce((sum,p) => sum+figures(p).length,0) : pages.length;
			const current = media.matches ? pages.slice(0,pageIndex).reduce((sum,p) => sum+figures(p).length,0)+figureIndex+1 : pageIndex+1;
			progress.textContent = `${String(current).padStart(2,"0")} / ${String(count).padStart(2,"0")}`;
			previous.disabled = current === 1;
			next.disabled = current === count;
			chapter.value = pages[pageIndex].id;
		};
		const bookmark = () => history.replaceState(history.state,"",`#${pages[pageIndex].id}`);
		const turn = (direction: number) => {
			if ((direction < 0 && previous.disabled) || (direction > 0 && next.disabled)) return;
			if (media.matches) {
				figureIndex += direction;
				if (figureIndex >= figures(pages[pageIndex]).length) { pageIndex++; figureIndex=0; }
				if (figureIndex < 0) { pageIndex--; figureIndex=figures(pages[pageIndex]).length-1; }
			} else { pageIndex += direction; figureIndex=0; }
			update(); bookmark();
		};
		controls.hidden=false;
		this.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach(button => button.addEventListener("click",() => {
			mode=button.dataset.mode!; figureIndex=0; update();
			if (mode === "scroll") pages[pageIndex].scrollIntoView({block:"start"});
			else controls.scrollIntoView({block:"start"});
		},{signal}));
		previous.addEventListener("click",() => turn(-1),{signal});
		next.addEventListener("click",() => turn(1),{signal});
		chapter.addEventListener("change",() => {
			pageIndex=pages.findIndex(p => p.id === chapter.value); figureIndex=0; update(); bookmark();
			if (mode === "scroll") pages[pageIndex].scrollIntoView({block:"start"});
		},{signal});
		window.addEventListener("keydown",event => {
			if (mode !== "book" || document.querySelector(".fancybox__container") || event.altKey || event.ctrlKey || event.metaKey || (event.target as HTMLElement)?.closest("input,textarea,select,button,a,[contenteditable]")) return;
			if (event.key === "ArrowRight" || event.key === "ArrowLeft") { event.preventDefault(); turn(event.key === "ArrowRight" ? 1 : -1); }
		},{signal});
		window.addEventListener("hashchange",() => { const i=pages.findIndex(p => p.id === location.hash.slice(1)); if (i>=0) { pageIndex=i; figureIndex=0; update(); } },{signal});
		media.addEventListener("change",() => { figureIndex=0; update(); },{signal});
		let start: {x:number;y:number} | null=null;
		this.querySelector<HTMLElement>("[data-pages]")!.addEventListener("touchstart",event => {
			if(event.touches.length !== 1) { start=null; return; }
			start={x:event.touches[0].clientX,y:event.touches[0].clientY};
		},{signal,passive:true});
		this.querySelector<HTMLElement>("[data-pages]")!.addEventListener("touchend",event => {
			if(mode !== "book" || !start || !event.changedTouches.length) return;
			const dx=event.changedTouches[0].clientX-start.x, dy=event.changedTouches[0].clientY-start.y;
			if(Math.abs(dx)>70 && Math.abs(dx)>Math.abs(dy)*2) turn(dx<0 ? 1 : -1);
			start=null;
		},{signal,passive:true});
		update();
	}
	disconnectedCallback() { this.controller?.abort(); }
}
if (!customElements.get("photobook-reader")) customElements.define("photobook-reader",PhotobookReader);
