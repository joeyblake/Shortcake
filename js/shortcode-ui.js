var Shortcode_UI;

( function( $ ) {

jQuery(document).ready(function(){

	var t = Shortcode_UI = this;

	t.model = {};
	t.collection = {};
	t.view = {};

	// Controller Model
	t.model.Shortcode_UI = Backbone.Model.extend({
		_this: this,
		openInsertModal: function() {
			this.set( 'action', 'select' );
			this.set( 'currentShortcode', null );
			this.set( 'markerEl', null );
			frame = new t.view.insertModal.frame( this );
			frame.open();
		},
		openEditModal: function( shortcodeModel, markerEl ) {
			this.set( 'action', 'update' );
			this.set( 'currentShortcode', shortcodeModel );
			this.set( 'markerEl', markerEl );
			frame = new t.view.insertModal.frame( this );
			frame.open();
		},
	});

	// Single Shortcode Model.
	t.model.Shortcode = Backbone.Model.extend({

		defaults: {
			label: '',
			shortcode: '',
			attrs: {},
			content: '',
		},

		/**
		 * Get the shortcode as... well a shortcode!
		 * Also - pro JS templates ;)
		 *
		 * @return string eg [shortcode attr1=value]
		 */
		formatShortcode: function() {

			var template, shortcodeAttributes, _attrs = [], content;

			shortcodeAttributes = this.get( 'attrs' );
			for ( var id in shortcodeAttributes ) {
				_attrs.push( id + '="' + shortcodeAttributes[id] + '"' );
			}

			content = this.get( 'content' );

			if ( content && content.length > 1 ) {
				template = "[shortcode attributes]content[/shortcode]"
			} else {
				template = "[shortcode attributes]"
			}

			template = template.replace( /shortcode/g, this.get('shortcode') );
			template = template.replace( /attributes/g, _attrs.join( ' ' ) );
			template = template.replace( /content/g, content );

			return template;

		}

	});

	// Shortcode Collection
	t.collection.Shortcodes = Backbone.Collection.extend({
		model: t.model.Shortcode
	});

	/**
	 * Single shortcode list item view.
	 * Used for add new shortcode modal.
	 */
	t.view.insertModalListItem = Backbone.View.extend({
		tagName: 'li',
		template:  wp.template('add-shortcode-list-item'),
		className: 'shortcode-list-item',

		render: function(){

			var data = this.model.toJSON();

			this.$el.attr( 'data-shortcode', data.shortcode );

			if ( ( 'image' in data ) && 0 === data.image.indexOf( 'dashicons-' ) ) {
				data.image = '<div class="dashicons ' + data.image + '"></div>';
			}

			return this.$el.html( this.template( data ) );
		}
	});

	/**
	 * Single edit shortcode content view.
	 * Used for add/edit shortcode modal.
	 */
	t.view.editModalListItem = Backbone.View.extend({

		template: wp.template('edit-shortcode-content-default'),

		events: {
			'keyup .edit-shortcode-form-fields input[type="text"]': 'inputValueChanged',
			'keyup .edit-shortcode-form-fields textarea': 'inputValueChanged',
			'change .edit-shortcode-form-fields select': 'inputValueChanged',
		},

		// Handle custom params passed to view.
		initialize: function(options) {
		    this.options = {};
		    this.options.action = options.action;
		},

		/**
		 * Input Changed Update Callback.
		 *
		 * If the input field that has changed is for content or a valid attribute,
		 * then it should update the model.
		 */
		inputValueChanged: _.debounce( function( e ) {

			var $el = $( e.target );

			if ( 'content' === $el.attr('name') ) {

				this.model.set( 'content', $el.val() );

			} else {

				var shortcodeAttributes = this.model.get( 'attrs' );

				// Note - check this is a valid attribute first.
				var id = $el.attr('name');
				if ( id in shortcodeAttributes ) {
					shortcodeAttributes[ id ] = $el.val();
				}

				this.model.set( 'attrs', shortcodeAttributes );

			}

		}, 100 ),

		/**
		 * Render the Edit form.
		 * Uses custom template passed by model if available
		 * Otherwise - displays functional default.
		 */
		render: function(){

			var template;

			// If the model has provided its own template - use that.
			// @todo - this would be better set as a default on the model?
			if ( templateEditForm = this.model.get('templateEditForm') ) {
				templateEditForm = wp.template( templateEditForm );
			} else {
				templateEditForm = this.template;
			}

			return this.$el.html( templateEditForm( this.model.toJSON() ) );

		},

	});

	t.view.insertModal = {

		frame: function( delegate ) {

			if ( this._frame )
				return this._frame;

			var _frame = wp.media.view.Frame.extend({

				className: 'media-frame',
				template:  wp.media.template('shortcode-ui-media-frame'),
				model: delegate,
				events: {
					"click .add-shortcode-list li": "selectEditShortcode",
					"click .media-button-insert": "insertShortcode",
					"submit .edit-shortcode-form": "insertShortcode",
					"click .edit-shortcode-form-cancel": 'cancelInsert'
				},

				initialize: function( a ) {

					this.shortcodes = Shortcode_UI.shortcodes;

					this.options = this.model.attributes;

					if ( ! this.options.action ) {
						this.options.action = 'select';
					}

					wp.media.view.Frame.prototype.initialize.apply( this, arguments );

					// Ensure core UI is enabled.
					this.$el.addClass('wp-core-ui');

					this.originalActiveEditor = false;

					// Initialize modal container view.
					this.modal = new wp.media.view.Modal({
						controller: this,
						title:	  "Edit Image"
					});

					this.modal.content( this );

					this.activeRichTextEditors = Array();

					this.modal.$el.addClass('shortcode-ui-insert-modal')

				},

				render: function() {

					var r = wp.media.view.Frame.prototype.render.apply( this, arguments );

					this.$toolbarEl  = this.$el.find( '.media-frame-toolbar' );
					this.$contentEl = this.$el.find( '.media-frame-content' );

					this.$contentEl.html('');
					this.$toolbarEl.html('');

					switch( this.options.action ) {
						case 'select' :
							this.renderAddShortcodeList();
							break;
						case 'update' :
						case 'insert' :
							this.renderEditShortcodeForm();
							break;
					}

					this.renderFooter();

					return r;
				},

				renderAddShortcodeList: function() {

					var list = $('<ul class="add-shortcode-list">');

					this.shortcodes.each( function( shortcode ) {
						var view = new t.view.insertModalListItem( { model: shortcode } );
						list.append( view.render( shortcode.toJSON() ) );
					} );

					this.$contentEl.append( list );

				},

				renderEditShortcodeForm: function() {
					var view = new t.view.editModalListItem( {
						model:  this.options.currentShortcode,
						action: this.options.action
					} );

					this.$contentEl.append( view.render() );

					if ( this.options.action === 'update' ) {
						this.$contentEl.find( '.edit-shortcode-form-cancel' ).remove();
					}

				},

				// @todo make this nicer.
				renderFooter: function() {

					var toolbar = $( '<div class="media-toolbar" />' );
					var el = $( '<div class="media-toolbar-primary" />' );
					var buttonSubmit = $('<button href="#" class="button media-button button-primary button-large media-button-insert" disabled="disabled">Insert into post</button>');

					buttonSubmit.appendTo( el );
					el.appendTo( toolbar );
					toolbar.appendTo( this.$toolbarEl );

					switch( this.options.action ) {
						case 'select' :
							buttonSubmit.attr( 'disabled', 'disabled' );
							break;
						case 'insert' :
							buttonSubmit.removeAttr( 'disabled' );
							break;
						case 'update' :
							buttonSubmit.removeAttr( 'disabled' );
							buttonSubmit.html( 'Update' );
							break;
					}

				},

				cancelInsert: function() {
					this.options.action = 'select';
					this.options.currentShortcode = null;
					this.render();
				},

				selectEditShortcode: function(e) {
					this.options.action = 'insert';
					var target    = $(e.currentTarget).closest( '.shortcode-list-item' );
					var shortcode = this.shortcodes.findWhere( { shortcode: target.attr( 'data-shortcode' ) } );
					this.options.currentShortcode = shortcode.clone();
					this.render();
				},

				insertShortcode: function() {
					var shortcode = this.options.currentShortcode.formatShortcode();
					send_to_editor( shortcode );
					this.close();
				}

			});

			// Map some of the modal's methods to the frame.
			_.each(['open','close','attach','detach','escape'], function( method ) {
				_frame.prototype[ method ] = function( view ) {
					if ( this.modal )
						this.modal[ method ].apply( this.modal, arguments );
					return this;
				};
			});

			this._frame = new _frame();

			return this._frame;
		},

		render: function() {

		},

		init: function() {

		}

	};

	t.shortcodes = new t.collection.Shortcodes( shortcodeUIData.shortcodes )
	t.modal      = new t.model.Shortcode_UI( shortcodeUIData.modalOptions );

	jQuery('.shortcode-editor-open-insert-modal').click( function(e) {
		e && e.preventDefault();
		t.modal.openInsertModal();
	});

	var options = {

		View: {

			template: media.template( 'shortcode-default-render' ),

			initialize: function( options ) {

				var shortcode = Shortcode_UI.shortcodes.findWhere( { shortcode: options.shortcode.tag } );

				if ( ! shortcode ) {
					return;
				}

				var template = shortcode.get( 'templateRenderJS' );
				if ( template ) {
					this.template = media.template( template );
				}

				shortcode = shortcode.clone();
				shortcode.set( 'content', options.shortcode.content );

				var attrs = shortcode.get( 'attrs' );
				for ( var id in options.shortcode.attrs.named ) {
					if ( id in attrs ) {
						attrs[ id ] = options.shortcode.attrs.named[ id ];
					}
				}
				shortcode.set( 'attrs', attrs );

				this.shortcode = shortcode;

			},

			getHtml: function() {
				var options = this.shortcode.get( 'attrs' );
				options.content   = this.shortcode.get( 'content' );
				options.shortcode = this.shortcode.get( 'shortcode' );
				return this.template( options );
			}
		},

		edit: function( node ) {

			var shortcodeString, model, attrs;

			shortcodeString = decodeURIComponent( $(node).attr( 'data-wpview-text' ) );

			var megaRegex = /\[(\S+)([^\]]+)?\]([^\[]*)?(\[\/(\S+?)\])?/;
			var matches = shortcodeString.match( megaRegex );

			if ( ! matches ) {
				return;
			}

			model = Shortcode_UI.shortcodes.findWhere( { shortcode: matches[1] } ).clone();

			if ( ! model ) {
				return;
			}

			attrs = model.get( 'attrs' );

			if ( typeof( matches[2] ) != undefined ) {

				attributeMatches = matches[2].match(/(\S+?=".*?")/g );

				// convert attribute strings to object.
				for ( var i = 0; i < attributeMatches.length; i++ ) {

					var bitsRegEx = /(\S+?)="(.*?)"/g;
					var bits = bitsRegEx.exec( attributeMatches[i] );

					if ( bits[1] in attrs ) {
						attrs[ bits[1] ] = bits[2];
					}

				}

			}

			model.set( 'attrs', attrs ); // note slice - remove ". @todo - make more robust.

			if ( matches[3] ) {
				model.set( 'content', matches[3] );
			}

			Shortcode_UI.modal.openEditModal( model, $(node) );

		}

	}

	t.shortcodes.each( function( shortcode ) {
		var newOptions = jQuery.extend( true, {}, options );
		wp.mce.views.register( shortcode.get('shortcode' ), newOptions );
	} );



});

} )( jQuery );
