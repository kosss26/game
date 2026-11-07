import {lockPageScroll} from '../modal-scroll';
test('nested modal cleanup restores scrolling regardless of cleanup order',()=>{
 const previous=global.document;
 Object.defineProperty(global,'document',{configurable:true,value:{body:{style:{overflow:'auto'}}}});
 try {const outer=lockPageScroll();const inner=lockPageScroll();outer();expect(document.body.style.overflow).toBe('hidden');inner();expect(document.body.style.overflow).toBe('auto');inner();expect(document.body.style.overflow).toBe('auto');} finally {Object.defineProperty(global,'document',{configurable:true,value:previous})}
});
