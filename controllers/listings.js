const Listing = require("../models/listing");
const mbxGeocoding = require('@mapbox/mapbox-sdk/services/geocoding');
const mapToken = process.env.MAP_TOKEN;
const geocodingClient = mbxGeocoding({ accessToken: mapToken });

module.exports.index = async(req,res) => {
    const allListings = await Listing.find({});
    res.render("listings/index.ejs",{ allListings });
};

module.exports.renderNewForm = (req,res) => {
    res.render("listings/new.ejs");
};

module.exports.showListing = async(req,res) => {
    let { id } = req.params;
    let listing = await Listing.findById(id).populate({path: "reviews", populate: {path: "author"}}).populate("owner");
    if (!listing) {
        req.flash("error", "Listing does not exist");
        return res.redirect("/listings");
    }
    res.render("listings/show.ejs",{listing});
};

module.exports.createListiing = async(req,res, next) => {
    let response = await geocodingClient.forwardGeocode({
        query: req.body.listing.location,
        limit: 1
    })
    .send();

    let url = req.file.path;
    let filename = req.file.filename;
    const newListing = new Listing(req.body.listing);
    newListing.owner = req.user._id;
    newListing.image = {url, filename};

    newListing.geometery = response.body.features[0].geometry;

    let savedListing = await newListing.save();
    console.log(savedListing);
    req.flash("success", "New listing created!");
    res.redirect("/listings");
};

module.exports.editListing = async (req,res) => {
    let { id } = req.params;
    let listing = await Listing.findById(id);
    if (!listing) {
        req.flash("error", "Listing you requested for does not exist");
        return res.redirect("/listings");
    }
    let originalImage = listing.image.url;
    let originalImageUrl = originalImage.replace("/upload", "/upload/,w_250");
    res.render("listings/edit.ejs", { listing, originalImageUrl });
};

module.exports.updateListing = async (req,res) => {
    let { id } = req.params;
    let listing = await Listing.findByIdAndUpdate(id, {...req.body.listing});
    if(typeof req.file !== "undefined") {
        let url = req.file.path;
        let filename = req.file.filename;
        listing.image = {url, filename};
        await listing.save();
    }
    req.flash("success", "Listing updated!");
    res.redirect(`/listings/${id}`);
};

module.exports.destroyListing = async (req,res) => {
    let { id } = req.params;
    let deleteListing = await Listing.findByIdAndDelete(id);
    console.log(deleteListing);
    req.flash("success", "Listing Deleted!");
    res.redirect("/listings");

};

module.exports.search = async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim();
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(24, Math.max(6, parseInt(req.query.limit) || 12));
    if (!q) {
      return res.render('listings/search', { results: [], total: 0, q: '', page, limit });
    }

    if (q.length > 200) {
      return res.status(400).send('Query too long');
    }

    const filter = { $text: { $search: q, $language: 'english' } };
    const projection = { score: { $meta: 'textScore' }, title: 1, description: 1, image: 1, price: 1, location: 1, country: 1 };

    const results = await Listing.find(filter, projection)
      .sort({ score: { $meta: 'textScore' }, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .exec();

    const total = await Listing.countDocuments(filter);

    res.render('listings/search', { results, total, q, page, limit });
  } catch (err) {
    next(err);
  }
};
