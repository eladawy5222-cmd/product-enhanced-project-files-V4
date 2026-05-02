/********** accessibility **********/

var travelMonster = travelMonster || {};

// event "polyfill"
travelMonster.createEvent = function (eventName) {
  var event;
  if (typeof window.Event === "function") {
    event = new Event(eventName);
  } else {
    event = document.createEvent("Event");
    event.initEvent(eventName, true, false);
  }
  return event;
};

// Animation helper functions
travelMonster.slideToggle = function (element, duration) {
  duration = duration || 300;
  if (
    element.offsetHeight === 0 ||
    window.getComputedStyle(element).display === "none"
  ) {
    travelMonster.slideDown(element, duration);
  } else {
    travelMonster.slideUp(element, duration);
  }
};

travelMonster.slideDown = function (element, duration) {
  duration = duration || 300;
  element.style.removeProperty("display");
  var display = window.getComputedStyle(element).display;
  if (display === "none") display = "block";
  element.style.display = display;
  var height = element.offsetHeight;
  element.style.overflow = "hidden";
  element.style.height = 0;
  element.style.paddingTop = 0;
  element.style.paddingBottom = 0;
  element.style.marginTop = 0;
  element.style.marginBottom = 0;
  void element.offsetHeight; // Force reflow
  element.style.transition =
    "height " +
    duration +
    "ms ease, padding " +
    duration +
    "ms ease, margin " +
    duration +
    "ms ease";
  element.style.height = height + "px";
  element.style.removeProperty("padding-top");
  element.style.removeProperty("padding-bottom");
  element.style.removeProperty("margin-top");
  element.style.removeProperty("margin-bottom");
  setTimeout(function () {
    element.style.removeProperty("height");
    element.style.removeProperty("overflow");
    element.style.removeProperty("transition");
  }, duration);
};

travelMonster.slideUp = function (element, duration) {
  duration = duration || 300;
  element.style.height = element.offsetHeight + "px";
  void element.offsetHeight; // Force reflow
  element.style.overflow = "hidden";
  element.style.transition =
    "height " +
    duration +
    "ms ease, padding " +
    duration +
    "ms ease, margin " +
    duration +
    "ms ease";
  element.style.height = 0;
  element.style.paddingTop = 0;
  element.style.paddingBottom = 0;
  element.style.marginTop = 0;
  element.style.marginBottom = 0;
  setTimeout(function () {
    element.style.display = "none";
    element.style.removeProperty("height");
    element.style.removeProperty("padding-top");
    element.style.removeProperty("padding-bottom");
    element.style.removeProperty("margin-top");
    element.style.removeProperty("margin-bottom");
    element.style.removeProperty("overflow");
    element.style.removeProperty("transition");
  }, duration);
};

/*  -----------------------------------------------------------------------------------------------
    Cover Modals
--------------------------------------------------------------------------------------------------- */

travelMonster.coverModals = {
  init: function () {
    if (document.querySelector(".cover-modal")) {
      // Handle cover modals when they're toggled.
      this.onToggle();

      // Close on escape key press.
      this.closeOnEscape();

      // Hide and show modals before and after their animations have played out.
      this.hideAndShowModals();

      this.keepFocusInModal();
    }
  },

  // Handle cover modals when they're toggled.
  onToggle: function () {
    document.querySelectorAll(".cover-modal").forEach(function (element) {
      element.addEventListener("toggled", function (event) {
        var modal = event.target,
          body = document.body;

        if (modal.classList.contains("active")) {
          body.classList.add("showing-modal");
        } else {
          body.classList.remove("showing-modal");
          body.classList.add("hiding-modal");

          // Remove the hiding class after a delay, when animations have been run.
          setTimeout(function () {
            body.classList.remove("hiding-modal");
          }, 500);
        }
      });
    });
  },

  // Close modal on escape key press.
  closeOnEscape: function () {
    document.addEventListener(
      "keydown",
      function (event) {
        if (event.key === "Escape") {
          event.preventDefault();
          document.querySelectorAll(".cover-modal.active").forEach(
            function (element) {
              this.untoggleModal(element);
            }.bind(this),
          );
        }
      }.bind(this),
    );
  },

  // Hide and show modals before and after their animations have played out.
  hideAndShowModals: function () {
    var _doc = document,
      _win = window,
      modals = _doc.querySelectorAll(".cover-modal"),
      adminBar = _doc.querySelector("#wpadminbar");

    function getAdminBarHeight(negativeValue) {
      var height,
        currentScroll = _win.pageYOffset;

      if (adminBar) {
        height = currentScroll + adminBar.getBoundingClientRect().height;

        return negativeValue ? -height : height;
      }

      return currentScroll === 0 ? 0 : -currentScroll;
    }

    function htmlStyles() {
      var overflow =
        _win.innerHeight > _doc.documentElement.getBoundingClientRect().height;

      return {
        "overflow-y": overflow ? "hidden" : "scroll",
        position: "fixed",
        width: "100%",
        top: getAdminBarHeight(true) + "px",
        left: 0,
      };
    }

    // Show the modal.
    modals.forEach(function (modal) {
      modal.addEventListener("toggle-target-before-inactive", function (event) {
        if (event.target !== modal) {
          return;
        }

        modal.classList.add("show-modal");
      });

      // Hide the modal after a delay, so animations have time to play out.
      modal.addEventListener("toggle-target-after-inactive", function (event) {
        if (event.target !== modal) {
          return;
        }

        setTimeout(function () {
          var clickedEl = travelMonster.toggles.clickedEl;

          modal.classList.remove("show-modal");

          if (clickedEl !== false) {
            clickedEl.focus();
            clickedEl = false;
          }

          _win.travelMonster.scrolled = 0;
        }, 500);
      });
    });
  },

  // Untoggle a modal.
  untoggleModal: function (modal) {
    var modalTargetClass,
      modalToggle = false;

    // If the modal has specified the string (ID or class) used by toggles to target it, untoggle the toggles with that target string.
    // The modal-target-string must match the string toggles use to target the modal.
    if (modal.dataset.modalTargetString) {
      modalTargetClass = modal.dataset.modalTargetString;

      modalToggle = document.querySelector(
        '*[data-toggle-target="' + modalTargetClass + '"]',
      );
    }

    // If a modal toggle exists, trigger it so all of the toggle options are included.
    if (modalToggle) {
      modalToggle.click();

      // If one doesn't exist, just hide the modal.
    } else {
      modal.classList.remove("active");
    }
  },

  keepFocusInModal: function () {
    var _doc = document;

    _doc.addEventListener("keydown", function (event) {
      var toggleTarget,
        modal,
        selectors,
        elements,
        menuType,
        bottomMenu,
        activeEl,
        lastEl,
        firstEl,
        tabKey,
        shiftKey,
        clickedEl = travelMonster.toggles.clickedEl;

      if (clickedEl && _doc.body.classList.contains("showing-modal")) {
        toggleTarget = clickedEl.dataset.toggleTarget;
        selectors = "input, a, button";
        modal = _doc.querySelector(toggleTarget);

        if (!modal) return;

        elements = modal.querySelectorAll(selectors);
        elements = Array.prototype.slice.call(elements);

        if (".menu-modal" === toggleTarget) {
          menuType = window.matchMedia("(min-width: 99999px)").matches;
          menuType = menuType ? ".expanded-menu" : ".mobile-menu";

          elements = elements.filter(function (element) {
            return (
              null !== element.closest(menuType) &&
              null !== element.offsetParent
            );
          });

          elements.unshift(_doc.querySelector(".close-nav-toggle"));

          bottomMenu = _doc.querySelector(".menu-bottom > nav");

          if (bottomMenu) {
            bottomMenu.querySelectorAll(selectors).forEach(function (element) {
              elements.push(element);
            });
          }
        }

        if (".main-menu-modal" === toggleTarget) {
          menuType = window.matchMedia("(min-width: 1025px)").matches;
          menuType = menuType ? ".expanded-menu" : ".mobile-menu";

          elements = elements.filter(function (element) {
            return (
              null !== element.closest(menuType) &&
              null !== element.offsetParent
            );
          });

          elements.unshift(_doc.querySelector(".close-main-nav-toggle"));

          bottomMenu = _doc.querySelector(".menu-bottom > nav");

          if (bottomMenu) {
            bottomMenu.querySelectorAll(selectors).forEach(function (element) {
              elements.push(element);
            });
          }
        }

        lastEl = elements[elements.length - 1];
        firstEl = elements[0];
        activeEl = _doc.activeElement;
        tabKey = event.key === "Tab";
        shiftKey = event.shiftKey;

        if (!shiftKey && tabKey && lastEl === activeEl) {
          event.preventDefault();
          firstEl.focus();
        }

        if (shiftKey && tabKey && firstEl === activeEl) {
          event.preventDefault();
          lastEl.focus();
        }
      }
    });
  },
}; // travelMonster.coverModals

travelMonster.modalMenu = {
  init: function () {
    // If the current menu item is in a sub level, expand all the levels higher up on load.
    this.expandLevel();
  },

  expandLevel: function () {
    var modalMenus = document.querySelectorAll(".modal-menu");

    modalMenus.forEach(function (modalMenu) {
      var activeMenuItem = modalMenu.querySelector(".current-menu-item");

      if (activeMenuItem) {
        travelMonsterFindParents(activeMenuItem, "li").forEach(
          function (element) {
            var subMenuToggle = element.querySelector(".submenu-toggle-btn");
            if (subMenuToggle) {
              travelMonster.toggles.performToggle(subMenuToggle, true);
            }
          },
        );
      }
    });
  },
}; // travelMonster.modalMenu

travelMonster.toggles = {
  clickedEl: false,

  init: function () {
    // Do the toggle.
    this.toggle();
  },

  performToggle: function (element, instantly) {
    var target,
      timeOutTime,
      classToToggle,
      self = this,
      _doc = document,
      // Get our targets.
      toggle = element,
      targetString = toggle.dataset.toggleTarget,
      activeClass = "active";

    // Elements to focus after modals are closed.
    if (!_doc.querySelectorAll(".show-modal").length) {
      self.clickedEl = _doc.activeElement;
    }

    if (targetString === "next") {
      target = toggle.nextElementSibling;
    } else {
      target = _doc.querySelector(targetString);
    }

    // Check if target exists
    if (!target) return;

    // Trigger events on the toggle targets before they are toggled.
    if (target.classList.contains(activeClass)) {
      target.dispatchEvent(
        travelMonster.createEvent("toggle-target-before-active"),
      );
    } else {
      target.dispatchEvent(
        travelMonster.createEvent("toggle-target-before-inactive"),
      );
    }

    // Get the class to toggle, if specified.
    classToToggle = toggle.dataset.classToToggle
      ? toggle.dataset.classToToggle
      : activeClass;

    // For cover modals, set a short timeout duration so the class animations have time to play out.
    timeOutTime = 0;

    if (target.classList.contains("cover-modal")) {
      timeOutTime = 10;
    }

    setTimeout(function () {
      var focusElement,
        subMenued = target.classList.contains("sub-menu"),
        newTarget = subMenued
          ? toggle.closest(".menu-item").querySelector(".sub-menu")
          : target,
        duration = toggle.dataset.toggleDuration;

      // Toggle the target of the clicked toggle.
      if (
        toggle.dataset.toggleType === "slidetoggle" &&
        !instantly &&
        duration !== "0"
      ) {
        travelMonster.slideToggle(newTarget, duration);
      } else {
        newTarget.classList.toggle(classToToggle);
      }

      // If the toggle target is 'next', only give the clicked toggle the active class.
      if (targetString === "next") {
        toggle.classList.toggle(activeClass);
      } else if (target.classList.contains("sub-menu")) {
        toggle.classList.toggle(activeClass);
      } else {
        // If not, toggle all toggles with this toggle target.
        _doc
          .querySelectorAll('*[data-toggle-target="' + targetString + '"]')
          .forEach(function (el) {
            el.classList.toggle(activeClass);
          });
      }

      // Toggle aria-expanded on the toggle.
      travelMonsterToggleAttribute(toggle, "aria-expanded", "true", "false");

      if (
        self.clickedEl &&
        (toggle.getAttribute("class") || "").indexOf("close-") !== -1
      ) {
        travelMonsterToggleAttribute(
          self.clickedEl,
          "aria-expanded",
          "true",
          "false",
        );
      }

      // Toggle body class.
      if (toggle.dataset.toggleBodyClass) {
        _doc.body.classList.toggle(toggle.dataset.toggleBodyClass);
      }

      // Check whether to set focus.
      if (toggle.dataset.setFocus) {
        focusElement = _doc.querySelector(toggle.dataset.setFocus);

        if (focusElement) {
          if (target.classList.contains(activeClass)) {
            focusElement.focus();
          } else {
            focusElement.blur();
          }
        }
      }

      // Trigger the toggled event on the toggle target.
      target.dispatchEvent(travelMonster.createEvent("toggled"));

      // Trigger events on the toggle targets after they are toggled.
      if (target.classList.contains(activeClass)) {
        target.dispatchEvent(
          travelMonster.createEvent("toggle-target-after-active"),
        );
      } else {
        target.dispatchEvent(
          travelMonster.createEvent("toggle-target-after-inactive"),
        );
      }
    }, timeOutTime);
  },

  // Do the toggle.
  toggle: function () {
    var self = this;

    document
      .querySelectorAll("*[data-toggle-target]")
      .forEach(function (element) {
        element.addEventListener("click", function (event) {
          event.preventDefault();
          self.performToggle(element);
        });
      });
  },
}; // travelMonster.toggles

// submenu overflow detection
travelMonster.submenuPosition = {
  init: function () {
    this.handleSubmenus();
    this.handleResize();
  },

  handleSubmenus: function () {
    const submenuParents = document.querySelectorAll(
      ".primary-menu-wrapper li.menu-item-has-children",
    );

    submenuParents.forEach((parent) => {
      const submenus = parent.querySelectorAll(".sub-menu");

      submenus.forEach((submenu) => {
        // Only check positioning for visible submenus
        if (submenu.offsetParent !== null) {
          this.checkSubmenuPosition(submenu, parent);
        }
      });
    });
  },

  checkSubmenuPosition: function (submenu, parent) {
    const rect = submenu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const buffer = 20; // Add some buffer space

    // Check if submenu extends beyond the right edge of the viewport
    // 159984 is the value of left (9999rem * 16px) property given to submenu before hover
    if (rect.right + buffer - 159984 > viewportWidth) {
      parent.classList.add("reverse-submenu");
    } else {
      parent.classList.remove("reverse-submenu");
    }
  },

  handleResize: function () {
    let resizeTimer;

    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        this.handleSubmenus();
      }, 100); // Debounce resize events
    });
  },
};

/**
 * Is the DOM ready?
 *
 * This implementation is coming from https://gomakethings.com/a-native-javascript-equivalent-of-jquerys-ready-method/
 *
 * @param {Function} fn Callback function to run.
 */
function travelMonsterDomReady(fn) {
  if (typeof fn !== "function") {
    return;
  }

  if (
    document.readyState === "interactive" ||
    document.readyState === "complete"
  ) {
    return fn();
  }

  document.addEventListener("DOMContentLoaded", fn, false);
}

/* Toggle an attribute ----------------------- */

function travelMonsterToggleAttribute(element, attribute, trueVal, falseVal) {
  if (trueVal === undefined) {
    trueVal = true;
  }
  if (falseVal === undefined) {
    falseVal = false;
  }
  if (element.getAttribute(attribute) !== trueVal) {
    element.setAttribute(attribute, trueVal);
  } else {
    element.setAttribute(attribute, falseVal);
  }
}

/**
 * Traverses the DOM up to find elements matching the query.
 *
 * @param {HTMLElement} target
 * @param {string} query
 * @return {NodeList} parents matching query
 */
function travelMonsterFindParents(target, query) {
  var parents = [];

  // Recursively go up the DOM adding matches to the parents array.
  function traverse(item) {
    var parent = item.parentNode;
    if (parent instanceof HTMLElement) {
      if (parent.matches(query)) {
        parents.push(parent);
      }
      traverse(parent);
    }
  }

  traverse(target);

  return parents;
}

/******************************** */

(function () {
  "use strict";

  // Helper functions for animations
  const slideToggle = (element, duration = 300) => {
    if (element.offsetHeight === 0) {
      slideDown(element, duration);
    } else {
      slideUp(element, duration);
    }
  };

  const slideDown = (element, duration = 300) => {
    element.style.removeProperty("display");
    let display = window.getComputedStyle(element).display;
    if (display === "none") display = "block";
    element.style.display = display;
    const height = element.offsetHeight;
    element.style.overflow = "hidden";
    element.style.height = 0;
    element.style.paddingTop = 0;
    element.style.paddingBottom = 0;
    element.style.marginTop = 0;
    element.style.marginBottom = 0;
    void element.offsetHeight;
    element.style.transition = `height ${duration}ms ease, padding ${duration}ms ease, margin ${duration}ms ease`;
    element.style.height = height + "px";
    element.style.removeProperty("padding-top");
    element.style.removeProperty("padding-bottom");
    element.style.removeProperty("margin-top");
    element.style.removeProperty("margin-bottom");
    setTimeout(() => {
      element.style.removeProperty("height");
      element.style.removeProperty("overflow");
      element.style.removeProperty("transition");
    }, duration);
  };

  const slideUp = (element, duration = 300) => {
    element.style.height = element.offsetHeight + "px";
    void element.offsetHeight;
    element.style.overflow = "hidden";
    element.style.transition = `height ${duration}ms ease, padding ${duration}ms ease, margin ${duration}ms ease`;
    element.style.height = 0;
    element.style.paddingTop = 0;
    element.style.paddingBottom = 0;
    element.style.marginTop = 0;
    element.style.marginBottom = 0;
    setTimeout(() => {
      element.style.display = "none";
      element.style.removeProperty("height");
      element.style.removeProperty("padding-top");
      element.style.removeProperty("padding-bottom");
      element.style.removeProperty("margin-top");
      element.style.removeProperty("margin-bottom");
      element.style.removeProperty("overflow");
      element.style.removeProperty("transition");
    }, duration);
  };

  const fadeIn = (element, duration = 400) => {
    element.style.removeProperty("display");
    let display = window.getComputedStyle(element).display;
    if (display === "none") display = "block";
    element.style.opacity = 0;
    element.style.display = display;
    element.style.transition = `opacity ${duration}ms ease`;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        element.style.opacity = 1;
      });
    });
    setTimeout(() => {
      element.style.removeProperty("transition");
    }, duration);
  };

  const fadeOut = (element, duration = 400) => {
    element.style.opacity = 1;
    element.style.transition = `opacity ${duration}ms ease`;
    element.style.opacity = 0;
    setTimeout(() => {
      element.style.display = "none";
      element.style.removeProperty("opacity");
      element.style.removeProperty("transition");
    }, duration);
  };

  const smoothScrollTo = (target, duration = 600) => {
    const start = window.pageYOffset;
    const startTime = performance.now();

    const easeInOutQuad = (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);

    const scroll = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = easeInOutQuad(progress);
      window.scrollTo(0, start + (target - start) * ease);

      if (progress < 1) {
        requestAnimationFrame(scroll);
      }
    };

    requestAnimationFrame(scroll);
  };

  const getOuterHeight = (element, includeMargin = false) => {
    if (!element) return 0;
    let height = element.offsetHeight;
    if (includeMargin) {
      const style = window.getComputedStyle(element);
      height += parseInt(style.marginTop) + parseInt(style.marginBottom);
    }
    return height;
  };

  /* Header Search toggle
    --------------------------------------------- */
  function trapFocus(container) {
    const focusables = container.querySelectorAll(
      'a, button, input, textarea, select, [tabindex]:not([tabindex="-1"])',
    );
    const visible = Array.from(focusables).filter(
      (el) => !el.disabled && el.offsetParent !== null,
    );
    const first = visible[0];
    const last = visible[visible.length - 1];

    if (container._trapFocusHandler) {
      container.removeEventListener("keydown", container._trapFocusHandler);
    }

    container._trapFocusHandler = function (e) {
      if (e.key === "Tab") {
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    container.addEventListener("keydown", container._trapFocusHandler);
    if (first) first.focus();
  }

  document.querySelectorAll(".header-search-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const form = btn.parentElement.querySelector(".search-toggle-form");
      document.querySelectorAll(".search-toggle-form").forEach((f) => {
        f.style.display = "none";
        if (f._trapFocusHandler) {
          f.removeEventListener("keydown", f._trapFocusHandler);
          f._trapFocusHandler = null;
        }
      });
      form.style.display = "block";
      trapFocus(form);
    });
  });

  document.querySelectorAll(".btn-form-close").forEach((closeBtn) => {
    closeBtn.addEventListener("click", () => {
      const form = closeBtn.closest(".search-toggle-form");
      form.style.display = "none";
    });
  });

  document.addEventListener("keyup", (e) => {
    if (e.key === "Escape") {
      document
        .querySelectorAll(".search-toggle-form")
        .forEach((f) => (f.style.display = "none"));
    }
  });

  document
    .querySelectorAll(".search-toggle-form, .search-form")
    .forEach((el) => {
      el.addEventListener("click", (e) => e.stopPropagation());
    });

  document.addEventListener("click", () => {
    const isDesktop =
      window.innerWidth > 1024 &&
      !("ontouchstart" in window) &&
      !navigator.maxTouchPoints;

    if (isDesktop) {
      document
        .querySelectorAll(".search-toggle-form")
        .forEach((f) => (f.style.display = "none"));
    }
  });

  /* Notification bar
    --------------------------------------------- */
  document.addEventListener("click", (e) => {
    const closeBtn = e.target.closest(".notification-bar .close");
    if (closeBtn) {
      const stickyBarContent = closeBtn.parentElement.querySelector(
        ".sticky-bar-content",
      );
      if (stickyBarContent) {
        slideToggle(stickyBarContent);
      }
      const notificationBar = document.querySelector(".notification-bar");
      if (notificationBar) {
        notificationBar.classList.toggle("active");
      }
    }
  });

  // Sticky Widget
  if (travel_monster_custom.sticky_widget == "1" && window.innerWidth > 1024) {
    const secondary = document.getElementById("secondary");
    if (secondary) {
      secondary.classList.add("sticky-widget");

      if (travel_monster_custom.ed_sticky_header == "1") {
        const stickyHolder = document.querySelector(".sticky-holder");
        const lastWidget = document.querySelector(
          ".ed_last_widget_sticky #secondary .widget:last-child",
        );
        if (stickyHolder && lastWidget) {
          const stickyHeaderHeight = getOuterHeight(stickyHolder);
          lastWidget.style.top = stickyHeaderHeight + "px";
        }
      }
    }
  }

  /************ Mobile Menu *************/
  document
    .querySelectorAll(".mobile-menu-wrapper ul li.menu-item-has-children > a")
    .forEach((link) => {
      const button = document.createElement("button");
      button.className = "arrow-down";
      link.parentNode.insertBefore(button, link.nextSibling);
    });

  document
    .querySelectorAll(".mobile-menu-wrapper ul li .arrow-down")
    .forEach((arrow) => {
      arrow.addEventListener("click", function () {
        const submenu = this.parentElement.querySelector(".sub-menu");
        if (submenu) {
          slideToggle(submenu);
          this.classList.toggle("active");
        }
      });
    });

  // Mobile menu uses dual system: native toggle (data-toggle-target) + menu-open class for CSS
  let closingMenu = false;

  const mobileMenuOpener = document.querySelector(
    ".mobile-header .mobile-menu-opener",
  );
  if (mobileMenuOpener) {
    mobileMenuOpener.addEventListener("click", () => {
      document.body.classList.add("menu-open");
    });
  }

  const btnMenuClose = document.querySelector(".mobile-header .btn-menu-close");
  if (btnMenuClose) {
    btnMenuClose.addEventListener("click", () => {
      if (closingMenu) return;
      closingMenu = true;
      document.body.classList.remove("menu-open");
      setTimeout(() => {
        closingMenu = false;
      }, 100);
    });
  }

  const overlay = document.querySelector(".overlay");
  if (overlay) {
    overlay.addEventListener("click", () => {
      if (!closingMenu && btnMenuClose) {
        btnMenuClose.click();
      }
    });
  }

  // Script for back to top
  const toTopBtn = document.querySelector(".to_top");
  if (toTopBtn) {
    let isScrolling = false;

    const handleToTopVisibility = () => {
      if (!isScrolling) {
        window.requestAnimationFrame(() => {
          if (window.pageYOffset > 100) {
            if (toTopBtn.style.display === "none" || !toTopBtn.style.display) {
              fadeIn(toTopBtn);
            }
          } else {
            if (toTopBtn.style.display !== "none") {
              fadeOut(toTopBtn);
            }
          }
          isScrolling = false;
        });
        isScrolling = true;
      }
    };

    window.addEventListener("scroll", handleToTopVisibility, { passive: true });

    toTopBtn.addEventListener("click", (e) => {
      e.preventDefault();
      smoothScrollTo(0, 600);
      return false;
    });
  }

  // Sticky header (legacy)
  const stickyHolder = document.querySelector(".sticky-header .sticky-holder");
  const headerB = document.querySelector(".sticky-header .header-b");

  if (stickyHolder && headerB) {
    let topTotal = getOuterHeight(headerB);
    let isScrolling = false;

    const updateTopTotal = () => {
      // Recalculate trigger point on resize
      if (headerB && headerB.offsetParent !== null) {
        topTotal = getOuterHeight(headerB);
      }
    };

    const handleStickyScroll = () => {
      if (!isScrolling) {
        window.requestAnimationFrame(() => {
          // Check if element still exists in document (offsetParent would be null with position:fixed)
          if (!stickyHolder || !document.body.contains(stickyHolder)) {
            return;
          }

          const shouldBeSticky = window.scrollY > topTotal;
          const isCurrentlySticky = stickyHolder.classList.contains("sticky");

          if (shouldBeSticky && !isCurrentlySticky) {
            stickyHolder.classList.add("sticky");
          } else if (!shouldBeSticky && isCurrentlySticky) {
            stickyHolder.classList.remove("sticky");
          }

          isScrolling = false;
        });
        isScrolling = true;
      }
    };

    window.addEventListener("scroll", handleStickyScroll, { passive: true });
    window.addEventListener("resize", updateTopTotal, { passive: true });
  }

  /* Sticky Header Builder
    --------------------------------------------- */
  travelMonster.makeHeaderSticky = {
    init: function () {
      // Query elements inside init to ensure DOM is ready
      travelMonster.stickyHeader = document.querySelector(
        ".sticky-header .site-header.wte-header-builder",
      );
      const headerHeightDiv = document.querySelector(
        ".sticky-header .site-header+div",
      );

      if (null !== travelMonster.stickyHeader && null !== headerHeightDiv) {
        let isScrolling = false;
        let headerHeight = headerHeightDiv.offsetTop;

        const updateHeaderHeight = () => {
          // Check if element still exists in DOM before accessing properties
          if (headerHeightDiv && headerHeightDiv.offsetParent !== null) {
            headerHeight = headerHeightDiv.offsetTop;
          }
        };

        const handleScroll = () => {
          if (!isScrolling) {
            window.requestAnimationFrame(() => {
              // Check if sticky header still exists in document (offsetParent would be null with position:fixed)
              if (!travelMonster.stickyHeader || !document.body.contains(travelMonster.stickyHeader)) {
                return;
              }

              const shouldBeSticky = window.scrollY > headerHeight;
              const isCurrentlySticky =
                travelMonster.stickyHeader.classList.contains("is-sticky");

              if (shouldBeSticky && !isCurrentlySticky) {
                travelMonster.stickyHeader.classList.add("is-sticky");
              } else if (!shouldBeSticky && isCurrentlySticky) {
                travelMonster.stickyHeader.classList.remove("is-sticky");
              }

              isScrolling = false;
            });
            isScrolling = true;
          }
        };

        window.addEventListener("scroll", handleScroll, { passive: true });
        window.addEventListener("resize", updateHeaderHeight, {
          passive: true,
        });

        travelMonster.stickyHeader._scrollHandler = handleScroll;
        travelMonster.stickyHeader._resizeHandler = updateHeaderHeight;
      }
    },

    destroy: function () {
      if (
        travelMonster.stickyHeader &&
        travelMonster.stickyHeader._scrollHandler
      ) {
        window.removeEventListener(
          "scroll",
          travelMonster.stickyHeader._scrollHandler,
        );
        window.removeEventListener(
          "resize",
          travelMonster.stickyHeader._resizeHandler,
        );
        delete travelMonster.stickyHeader._scrollHandler;
        delete travelMonster.stickyHeader._resizeHandler;
      }
    },
  };

  // Alignfull js
  const updateAlignfullWidths = () => {
    const gbWindowWidth = window.innerWidth;
    const container = document.querySelector(
      ".travel-monster-has-blocks .site-content > .container",
    );
    const entryContent = document.querySelector(
      ".travel-monster-has-blocks .site-main .entry-content",
    );

    if (!container || !entryContent) return;

    const gbContainerWidth = container.offsetWidth;
    const gbContentWidth = entryContent.offsetWidth;
    const gbMarginFull = (gbContentWidth - gbWindowWidth) / 2;
    const gbMarginFull2 = (gbContentWidth - gbContainerWidth) / 2;

    document
      .querySelectorAll(
        ".travel-monster-has-blocks.full-width .site-main .entry-content .alignfull",
      )
      .forEach((el) => {
        el.style.maxWidth = gbWindowWidth + "px";
        el.style.width = gbWindowWidth + "px";
        el.style.marginLeft = gbMarginFull + "px";
      });

    document
      .querySelectorAll(
        ".travel-monster-has-blocks.full-width .site-main .entry-content .alignwide",
      )
      .forEach((el) => {
        el.style.maxWidth = gbContainerWidth + "px";
        el.style.width = gbContainerWidth + "px";
        el.style.marginLeft = gbMarginFull2 + "px";
      });
  };

  window.addEventListener("load", updateAlignfullWidths);
  window.addEventListener("resize", updateAlignfullWidths, { passive: true });

  // Single trip tab sticky
  const isInViewport = (element) => {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    const elementTop = rect.top + window.pageYOffset;
    const elementBottom = elementTop + element.offsetHeight;
    const viewportTop = window.pageYOffset;

    return elementTop < viewportTop && elementBottom > viewportTop;
  };

  const handleTabSticky = () => {
    const tabContents = document.querySelectorAll(".tab-content");
    let hasVisibleTab = false;

    tabContents.forEach((tab) => {
      if (isInViewport(tab)) {
        hasVisibleTab = true;
      }
    });

    if (hasVisibleTab) {
      document.body.classList.add("fixed-tabbar");
    } else {
      document.body.classList.remove("fixed-tabbar");
    }
  };

  let tabStickyScrolling = false;
  const throttledTabSticky = () => {
    if (!tabStickyScrolling) {
      window.requestAnimationFrame(() => {
        handleTabSticky();
        tabStickyScrolling = false;
      });
      tabStickyScrolling = true;
    }
  };

  window.addEventListener("resize", throttledTabSticky, { passive: true });
  window.addEventListener("scroll", throttledTabSticky, { passive: true });

  // Navigation Accessibility
  document.addEventListener("mousemove", () => {
    document.body.classList.remove("keyboard-nav-on");
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Tab") {
      document.body.classList.add("keyboard-nav-on");
    }
  });

  document
    .querySelectorAll(
      ".primary-menu-wrapper li a, .primary-menu-wrapper li .arrow-down, .secondary-menu-wrapper li a",
    )
    .forEach((link) => {
      link.addEventListener("focus", function () {
        let parent = this.closest("li");
        while (parent) {
          parent.classList.add("focus");
          parent = parent.parentElement
            ? parent.parentElement.closest("li")
            : null;
        }
      });

      link.addEventListener("blur", function () {
        let parent = this.closest("li");
        while (parent) {
          parent.classList.remove("focus");
          parent = parent.parentElement
            ? parent.parentElement.closest("li")
            : null;
        }
      });
    });

  // Breadcrumb dynamic height for single trip
  const breadcrumb = document.querySelector(
    ".travel-monster-breadcrumb-main-wrap",
  );
  const headerTop = document.querySelector(".page-header-top");
  if (breadcrumb && headerTop) {
    headerTop.style.setProperty(
      "--breadcrumb-margin",
      breadcrumb.offsetHeight + 16 + "px",
    );
  }

  // Helper function to check if element is on screen (replaces jQuery plugin)
  window.travel_monsterIsOnScreen = function (element) {
    if (!element) return false;

    const viewport = {
      top: window.pageYOffset,
      left: window.pageXOffset,
    };

    viewport.right = viewport.left + window.innerWidth;
    viewport.bottom = viewport.top + window.innerHeight;

    const rect = element.getBoundingClientRect();
    const bounds = {
      top: rect.top + window.pageYOffset,
      left: rect.left + window.pageXOffset,
    };
    bounds.right = bounds.left + element.offsetWidth;
    bounds.bottom = bounds.top + element.offsetHeight;

    return !(
      viewport.right < bounds.left ||
      viewport.left > bounds.right ||
      viewport.bottom < bounds.top ||
      viewport.top > bounds.bottom
    );
  };
})();

travelMonsterDomReady(function () {
  travelMonster.toggles.init();
  travelMonster.coverModals.init();
  travelMonster.modalMenu.init();
  travelMonster.submenuPosition.init();
  travelMonster.makeHeaderSticky.init();
});
